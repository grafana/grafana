package v1

import (
	"fmt"
	"hash/fnv"
	"regexp"
	"strings"
	"unsafe"

	"github.com/grafana/alerting/definition"
	"github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type TemplateGroup struct {
	ResourceMetadata

	Title   string
	Content string
	Kind    TemplateKind
}

func (t *TemplateGroup) ResourceType() string {
	return "template"
}

func (t *TemplateGroup) ResourceID() string {
	return t.Title
}

type TemplateKind string

const (
	TemplateKindGrafana TemplateKind = "grafana"
	TemplateKindMimir   TemplateKind = "mimir"
)

func (t *TemplateGroup) Validate() error {
	if t.Title == "" {
		return fmt.Errorf("template must have a name")
	}
	if t.Content == "" {
		return fmt.Errorf("template must have content")
	}

	content := strings.TrimSpace(t.Content)
	found, err := regexp.MatchString(`\{\{\s*define`, content)
	if err != nil {
		return fmt.Errorf("failed to match regex: %w", err)
	}
	if !found {
		lines := strings.Split(content, "\n")
		for i, s := range lines {
			lines[i] = "  " + s
		}
		content = strings.Join(lines, "\n")
		content = fmt.Sprintf("{{ define \"%s\" }}\n%s\n{{ end }}", t.Title, content)
	}
	t.Content = content
	if t.Kind == "" {
		t.Kind = TemplateKindGrafana
	}
	postable := definition.PostableApiTemplate{
		Name:    t.Title,
		Content: t.Content,
		Kind:    definition.TemplateKind(t.Kind),
	}
	if err := postable.Validate(); err != nil {
		return err
	}
	def := notify.PostableAPITemplateToTemplateDefinition(postable)
	return def.Validate()
}

// NewTemplateGroup creates a new TemplateGroup with the specified UID, name, content, kind, and provenance.
// If the UID is empty, it generates a deterministic UID based on the template kind and name.
func NewTemplateGroup(uid ResourceUID, name, content string, kind TemplateKind, provenance models.Provenance) TemplateGroup {
	if uid == "" {
		uid = TemplateUID(kind, name)
	}
	return TemplateGroup{
		ResourceMetadata: ResourceMetadata{
			UID:        uid,
			Version:    calculateTemplateFingerprint(content),
			Provenance: provenance,
		},
		Title:   name,
		Content: content,
		Kind:    kind,
	}
}

// TemplateFilesToTemplates converts a map of template files to a map of TemplateGroups.
// UIDs are generated deterministically based on the template name.
func TemplateFilesToTemplates(templateFiles map[string]string, kind TemplateKind) map[ResourceUID]TemplateGroup {
	if templateFiles == nil {
		return nil
	}

	templates := make(map[ResourceUID]TemplateGroup, len(templateFiles))
	for name, content := range templateFiles {
		tmpl := NewTemplateGroup("", name, content, kind, models.ProvenanceNone)
		templates[tmpl.UID] = tmpl
	}
	return templates
}

// TemplatesToTemplateFiles converts a map of TemplateGroups to a map of template files.
func TemplatesToTemplateFiles(templates map[ResourceUID]TemplateGroup) map[string]string {
	if templates == nil {
		return nil
	}

	templateFiles := make(map[string]string, len(templates))
	for _, tg := range templates {
		templateFiles[tg.Title] = tg.Content
	}
	return templateFiles
}

// TemplateUID generates a deterministic UID for a template based on its name.
func TemplateUID(kind TemplateKind, name string) ResourceUID {
	return ResourceUID(models.NameToUid(fmt.Sprintf("%s|%s", string(kind), name)))
}

func CalculateTemplateFingerprint(tmpl TemplateGroup) string {
	return calculateTemplateFingerprint(tmpl.Content)
}

func calculateTemplateFingerprint(t string) string {
	sum := fnv.New64()
	_, _ = sum.Write(unsafe.Slice(unsafe.StringData(t), len(t))) //nolint:gosec
	return fmt.Sprintf("%016x", sum.Sum64())
}
