package eval

import (
	"bytes"
	"html/template"

	"github.com/gobwas/glob"
)

var _ Evaluator = new(permission)

func Permission(action string, scope string) Evaluator {
	return &permission{
		Action: action,
		Scope:  scope,
	}
}

type permission struct {
	Action string
	Scope  string
	failed bool
}

func (p *permission) Evaluate(permissions map[string]map[string]struct{}) (bool, error) {
	scopes, ok := permissions[p.Action]
	if ok {
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
	}
	p.failed = true
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

func (p *permission) Failed() []permission {
	if p.failed {
		return []permission{*p}
	}
	return nil
}
