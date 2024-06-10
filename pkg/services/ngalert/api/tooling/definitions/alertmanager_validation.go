package definitions

import (
	"fmt"
	tmplhtml "html/template"
	"regexp"
	"strings"
	tmpltext "text/template"

	"github.com/prometheus/alertmanager/template"
	"gopkg.in/yaml.v3"
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

	// Validate template contents. We try to stick as close to what will actually happen when the templates are parsed
	// by the alertmanager as possible. That means parsing with both the text and html parsers and making sure we set
	// the template name and options.
	ttext := tmpltext.New(t.Name).Option("missingkey=zero")
	ttext.Funcs(tmpltext.FuncMap(template.DefaultFuncs))
	if _, err := ttext.Parse(t.Template); err != nil {
		return fmt.Errorf("invalid template: %w", err)
	}

	thtml := tmplhtml.New(t.Name).Option("missingkey=zero")
	thtml.Funcs(tmplhtml.FuncMap(template.DefaultFuncs))
	if _, err := thtml.Parse(t.Template); err != nil {
		return fmt.Errorf("invalid template: %w", err)
	}

	return nil
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
