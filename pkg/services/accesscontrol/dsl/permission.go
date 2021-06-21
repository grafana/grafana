package dsl

import (
	"bytes"
	"html/template"

	"github.com/gobwas/glob"
)

var _ Eval = new(permission)

func Permission(actions string, scope string) Eval {
	return &permission{
		Action: actions,
		Scope:  scope,
	}
}

type permission struct {
	Action string
	Scope  string
}

func (p *permission) Evaluate(permissions map[string]map[string]struct{}) (bool, error) {
	scopes, ok := permissions[p.Action]
	if !ok {
		return false, nil
	}

	if p.Scope == ScopeNone {
		return true, nil
	}

	for s := range scopes {
		rule, err := glob.Compile(s, ':', '/')
		if err != nil {
			return false, err
		}
		if rule.Match(p.Scope) {
			return true, nil
		}
	}
	return false, nil
}

func (p *permission) Inject(params map[string]string) error {
	tmpl, err := template.New("scope").Parse(p.Scope)
	if err != nil {
		return err
	}
	var buf bytes.Buffer
	if err = tmpl.Execute(&buf, params); err != nil {
		return err
	}
	p.Scope = buf.String()
	return nil
}
