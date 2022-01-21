package services

import (
	"crypto/md5"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/common"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type Template struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

type TemplateService interface {
	GetTemplates(orgID int64) ([]Template, error)
	CreateTemplate(orgID int64, template Template) (Template, error)
	UpdateTemplate(orgID int64, template Template) (Template, error)
	DeleteTemplate(orgID int64, name string) error
}

type EmbeddedTemplateService struct {
	amStore AMStore
}

var (
	ErrTemplateNameEmpty          = errors.New("template name is empty")
	ErrTemplateNameOrContentEmpty = errors.New("template name or content empty")
	ErrTemplateDuplicateName      = errors.New("template with this name already exists")
	ErrTemplateNotFound           = errors.New("template with this name not found")
)

type AMStore interface {
	GetLatestAlertmanagerConfiguration(*models.GetLatestAlertmanagerConfigurationQuery) error
	UpdateAlertManagerConfiguration(cmd *models.SaveAlertmanagerConfigurationCmd) error
}

func NewEmbeddedTemplateService(store AMStore) *EmbeddedTemplateService {
	return &EmbeddedTemplateService{
		amStore: store,
	}
}

func (templateStore *EmbeddedTemplateService) GetTemplates(orgID int64) ([]Template, error) {
	cfg, _, err := templateStore.getCurrentConfig(orgID)
	if err != nil {
		return nil, err
	}
	templates := []Template{}
	for name, content := range cfg.TemplateFiles {
		templates = append(templates, Template{Name: name, Content: content})
	}
	return templates, nil
}

func (templateStore *EmbeddedTemplateService) CreateTemplate(orgID int64, template Template) (Template, error) {
	if template.Name == "" || template.Content == "" {
		return Template{}, ErrTemplateNameOrContentEmpty
	}
	cfg, fetchedHash, err := templateStore.getCurrentConfig(orgID)
	if err != nil {
		return Template{}, err
	}
	if _, exists := cfg.TemplateFiles[template.Name]; exists {
		return Template{}, ErrTemplateDuplicateName
	}
	// notification template content must be wrapped in {{ define "name" }} tag,
	// but this is not obvious because user also has to provide name separately in the form.
	// so if user does not manually add {{ define }} tag, we do it automatically
	template.Content = ensureDefine(template.Name, template.Content)
	// ensure that we don't try write into a nil map if no template exists
	if cfg.TemplateFiles == nil {
		cfg.TemplateFiles = make(map[string]string, 1)
	}
	cfg.TemplateFiles[template.Name] = template.Content
	cfg.AlertmanagerConfig.Config.Templates = append(cfg.AlertmanagerConfig.Config.Templates, template.Name)
	data, err := json.Marshal(cfg)
	if err != nil {
		return Template{}, err
	}
	return template, templateStore.amStore.UpdateAlertManagerConfiguration(&models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration:     string(data),
		AlertmanagerConfigurationHash: fmt.Sprintf("%x", md5.Sum(data)),
		ConfigurationVersion:          "v1",
		Default:                       false,
		OrgID:                         orgID,
		FetchedHash:                   fetchedHash,
	})
}

func (templateStore *EmbeddedTemplateService) UpdateTemplate(orgID int64, template Template) (Template, error) {
	if template.Name == "" || template.Content == "" {
		return Template{}, ErrTemplateNameOrContentEmpty
	}
	cfg, fetchedHash, err := templateStore.getCurrentConfig(orgID)
	if err != nil {
		return Template{}, err
	}
	if _, exists := cfg.TemplateFiles[template.Name]; !exists {
		return Template{}, ErrTemplateNotFound
	}
	// notification template content must be wrapped in {{ define "name" }} tag,
	// but this is not obvious because user also has to provide name separately in the form.
	// so if user does not manually add {{ define }} tag, we do it automatically
	template.Content = ensureDefine(template.Name, template.Content)
	cfg.TemplateFiles[template.Name] = template.Content
	data, err := json.Marshal(cfg)
	if err != nil {
		return Template{}, err
	}
	return template, templateStore.amStore.UpdateAlertManagerConfiguration(&models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration:     string(data),
		AlertmanagerConfigurationHash: fmt.Sprintf("%x", md5.Sum(data)),
		ConfigurationVersion:          "v1",
		Default:                       false,
		OrgID:                         orgID,
		FetchedHash:                   fetchedHash,
	})
}

func (templateStore *EmbeddedTemplateService) DeleteTemplate(orgID int64, name string) error {
	if name == "" {
		return ErrTemplateNameEmpty
	}
	cfg, fetchedHash, err := templateStore.getCurrentConfig(orgID)
	if err != nil {
		return err
	}
	if _, exists := cfg.TemplateFiles[name]; !exists {
		return ErrTemplateNotFound
	}
	delete(cfg.TemplateFiles, name)
	for i, templateName := range cfg.AlertmanagerConfig.Templates {
		if templateName == name {
			cfg.AlertmanagerConfig.Templates = append(cfg.AlertmanagerConfig.Templates[:i], cfg.AlertmanagerConfig.Templates[i+1:]...)
			break
		}
	}
	data, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	return templateStore.amStore.UpdateAlertManagerConfiguration(&models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration:     string(data),
		AlertmanagerConfigurationHash: fmt.Sprintf("%x", md5.Sum(data)),
		ConfigurationVersion:          "v1",
		Default:                       false,
		OrgID:                         orgID,
		FetchedHash:                   fetchedHash,
	})
}

func (templateStore *EmbeddedTemplateService) getCurrentConfig(orgID int64) (*apimodels.PostableUserConfig, string, error) {
	query := &models.GetLatestAlertmanagerConfigurationQuery{
		OrgID: orgID,
	}
	err := templateStore.amStore.GetLatestAlertmanagerConfiguration(query)
	if err != nil {
		return nil, "", err
	}
	cfg, err := common.LoadAMConfig([]byte(query.Result.AlertmanagerConfiguration))
	if err != nil {
		return nil, "", err
	}
	return cfg, query.Result.AlertmanagerConfigurationHash, nil
}

func ensureDefine(name, content string) string {
	content = strings.TrimSpace(content)
	exp, err := regexp.Compile(`\{\{\s*define`)
	if err != nil {
		return content
	}
	// content is already wrapped in define
	if exp.Match([]byte(content)) {
		return content
	}
	lines := strings.Split(content, "\n")
	for i := range lines {
		lines[i] = "  " + lines[i]
	}
	content = strings.Join(lines, "\n")
	return fmt.Sprintf("{{ define \"%s\" }}\n%s\n{{ end }}", name, content)
}
