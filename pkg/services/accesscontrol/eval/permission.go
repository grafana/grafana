package eval

import (
	"bytes"
	"html/template"

	"github.com/gobwas/glob"
)

var _ Evaluator = new(permission)

func Permission(action string, scope string) Evaluator {
	return &permission{
		action: actions,
		scope:  scope,
	}
}

type permission struct {
	action string
	scope  string
}

func (p *permission) Evaluate(permissions map[string]map[string]struct{}) (bool, error) {
	scopes, ok := permissions[p.action]
	if !ok {
		return false, nil
	}

	if p.scope == ScopeNone {
		return true, nil
	}

	for s := range scopes {
		rule, err := glob.Compile(s, ':', '/')
		if err != nil {
			return false, err
		}
		if rule.Match(p.scope) {
			return true, nil
		}
	}
	return false, nil
}

func (p *permission) Inject(params map[string]string) error {
	tmpl, err := template.New("scope").Parse(p.scope)
	if err != nil {
		return err
	}
	var buf bytes.Buffer
	if err = tmpl.Execute(&buf, params); err != nil {
		return err
	}
	p.scope = buf.String()
	return nil
}
