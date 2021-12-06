package api

import (
	"crypto/md5"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	api "github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

type TemplateServer struct {
	store store.AlertingStore
}

func (s *TemplateServer) RouteCreateTemplate(c *api.ReqContext, template apimodels.PostableTemplate) response.Response {
	if !c.HasUserRole(api.ROLE_EDITOR) {
		return ErrResp(http.StatusForbidden, errors.New("permission denied"), "")
	}
	query := &models.GetLatestAlertmanagerConfigurationQuery{
		OrgID: c.OrgId,
	}
	err := s.store.GetLatestAlertmanagerConfiguration(query)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	cfg, err := notifier.Load([]byte(query.Result.AlertmanagerConfiguration))
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to unmarshal alertmanager configuration")
	}
	if _, exists := cfg.TemplateFiles[template.Name]; exists {
		return ErrResp(http.StatusInternalServerError, errors.New("duplicated template name"), "template with this name already exists")
	}
	if template.Name == "" || template.Content == "" {
		return ErrResp(http.StatusInternalServerError, errors.New("empty template"), "template name or content empty")
	}
	// notification template content must be wrapped in {{ define "name" }} tag,
	// but this is not obvious because user also has to provide name separately in the form.
	// so if user does not manually add {{ define }} tag, we do it automatically
	template.Content = ensureDefine(template.Name, template.Content)
	cfg.TemplateFiles[template.Name] = template.Content
	cfg.AlertmanagerConfig.Config.Templates = append(cfg.AlertmanagerConfig.Config.Templates, template.Name)
	data, err := json.Marshal(cfg)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to marshal alertmanager configuration")
	}
	err = s.store.UpdateAlertManagerConfiguration(&models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration:     string(data),
		AlertmanagerConfigurationHash: fmt.Sprintf("%x", md5.Sum(data)),
		ConfigurationVersion:          "v1",
		Default:                       false,
		OrgID:                         c.OrgId,
		FetchedHash:                   query.Result.AlertmanagerConfigurationHash,
	})
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to unmarshal alertmanager configuration")
	}
	return response.JSON(http.StatusOK, "")
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
