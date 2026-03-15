package definitions

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/grafana/alerting/definition"
	"github.com/grafana/alerting/notify"
	"go.yaml.in/yaml/v3"
)

func (t *NotificationTemplate) Validate() error {
	if t.Name == "" {
		return fmt.Errorf("template must have a name")
	}
	if t.Template == "" {
		return fmt.Errorf("template must have content")
	}

	content := strings.TrimSpace(t.Template)
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
		content = fmt.Sprintf("{{ define \"%s\" }}\n%s\n{{ end }}", t.Name, content)
	}
	t.Template = content
	if t.Kind == "" {
		t.Kind = definition.GrafanaTemplateKind
	}
	postable := definition.PostableApiTemplate{
		Name:    t.Name,
		Content: t.Template,
		Kind:    t.Kind,
	}
	if err := postable.Validate(); err != nil {
		return err
	}
	def := notify.PostableAPITemplateToTemplateDefinition(postable)
	return def.Validate()
}

func (mt *MuteTimeInterval) Validate() error {
	s, err := yaml.Marshal(mt.MuteTimeInterval)
	if err != nil {
		return err
	}
	if err = yaml.Unmarshal(s, &(mt.MuteTimeInterval)); err != nil {
		return err
	}
	return nil
}
