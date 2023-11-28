package definitions

import (
	"fmt"
	tmplhtml "html/template"
	"regexp"
	"strings"
	tmpltext "text/template"
	"time"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/common/model"
	"gopkg.in/yaml.v3"
)

// Validate normalizes a possibly nested Route r, and returns errors if r is invalid.
func (r *Route) validateChild() error {
	r.GroupBy = nil
	r.GroupByAll = false
	for _, l := range r.GroupByStr {
		if l == "..." {
			r.GroupByAll = true
		} else {
			r.GroupBy = append(r.GroupBy, model.LabelName(l))
		}
	}

	if len(r.GroupBy) > 0 && r.GroupByAll {
		return fmt.Errorf("cannot have wildcard group_by (`...`) and other other labels at the same time")
	}

	groupBy := map[model.LabelName]struct{}{}

	for _, ln := range r.GroupBy {
		if _, ok := groupBy[ln]; ok {
			return fmt.Errorf("duplicated label %q in group_by, %s %s", ln, r.Receiver, r.GroupBy)
		}
		groupBy[ln] = struct{}{}
	}

	if r.GroupInterval != nil && time.Duration(*r.GroupInterval) == time.Duration(0) {
		return fmt.Errorf("group_interval cannot be zero")
	}
	if r.RepeatInterval != nil && time.Duration(*r.RepeatInterval) == time.Duration(0) {
		return fmt.Errorf("repeat_interval cannot be zero")
	}

	// Routes are a self-referential structure.
	if r.Routes != nil {
		for _, child := range r.Routes {
			err := child.validateChild()
			if err != nil {
				return err
			}
		}
	}

	return nil
}

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

// Validate normalizes a Route r, and returns errors if r is an invalid root route. Root routes must satisfy a few additional conditions.
func (r *Route) Validate() error {
	if len(r.Receiver) == 0 {
		return fmt.Errorf("root route must specify a default receiver")
	}
	if len(r.Match) > 0 || len(r.MatchRE) > 0 {
		return fmt.Errorf("root route must not have any matchers")
	}
	if len(r.MuteTimeIntervals) > 0 {
		return fmt.Errorf("root route must not have any mute time intervals")
	}
	return r.validateChild()
}

func (r *Route) ValidateReceivers(receivers map[string]struct{}) error {
	if _, exists := receivers[r.Receiver]; !exists {
		return fmt.Errorf("receiver '%s' does not exist", r.Receiver)
	}
	for _, children := range r.Routes {
		err := children.ValidateReceivers(receivers)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *Route) ValidateMuteTimes(muteTimes map[string]struct{}) error {
	for _, name := range r.MuteTimeIntervals {
		if _, exists := muteTimes[name]; !exists {
			return fmt.Errorf("mute time interval '%s' does not exist", name)
		}
	}
	for _, child := range r.Routes {
		err := child.ValidateMuteTimes(muteTimes)
		if err != nil {
			return err
		}
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
