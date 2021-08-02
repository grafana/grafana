package rules

import (
	"bytes"
	"fmt"
	"html/template"
	"strings"

	"github.com/gobwas/glob"
)

const (
	ScopeAll = "*"
)

func Combine(scopes ...string) string {
	b := strings.Builder{}
	for i, s := range scopes {
		if i != 0 {
			b.WriteRune(':')
		}
		b.WriteString(s)
	}
	return b.String()
}

func Parameter(key string) string {
	return fmt.Sprintf(`{{ index . "%s" }}`, key)
}

type Evaluator interface {
	// Evaluate permissions that are grouped by action
	Evaluate(permissions map[string]map[string]struct{}) (bool, error)
	// Inject params into the evaluator's templated scopes. Eg. "settings:" + eval.Parameters(":id") and returns a new Evaluator
	Inject(params map[string]string) (Evaluator, error)
	// String returns a string representation of permission rules
	String() string
}

var _ Evaluator = new(permission)

// Permission creates a new permission rule that will require all scopes in combination with action to match
func Permission(action string, scopes ...string) Evaluator {
	return permission{Action: action, Scopes: scopes}
}

type permission struct {
	Action string
	Scopes []string
}

func (p permission) Evaluate(permissions map[string]map[string]struct{}) (bool, error) {
	userScopes, ok := permissions[p.Action]
	if !ok {
		return false, nil
	}

	if len(p.Scopes) == 0 {
		return true, nil
	}

	for _, target := range p.Scopes {
		var err error
		var matches bool

		for scope := range userScopes {
			matches, err = match(scope, target)
			if err != nil {
				return false, err
			}
			if matches {
				break
			}
		}
		if !matches {
			return false, nil
		}
	}

	return true, nil
}

func match(scope, target string) (bool, error) {
	// TODO: replace glob parser with a simpler parser that handles only prefixes and asterisk matching.
	rule, err := glob.Compile(scope, ':', '/')
	if err != nil {
		return false, err
	}
	if rule.Match(target) {
		return true, nil
	}
	return false, nil
}

func (p permission) Inject(params map[string]string) (Evaluator, error) {
	scopes := make([]string, 0, len(p.Scopes))
	for _, scope := range p.Scopes {
		tmpl, err := template.New("scope").Parse(scope)
		if err != nil {
			return nil, err
		}
		var buf bytes.Buffer
		if err = tmpl.Execute(&buf, params); err != nil {
			return nil, err
		}
		scopes = append(scopes, buf.String())
	}
	return Permission(p.Action, scopes...), nil
}

func (p permission) String() string {
	return ""
}

var _ Evaluator = new(all)

func All(allOf ...Evaluator) Evaluator {
	return all{allOf: allOf}
}

type all struct {
	allOf []Evaluator
}

func (a all) Evaluate(permissions map[string]map[string]struct{}) (bool, error) {
	for _, e := range a.allOf {
		if ok, err := e.Evaluate(permissions); !ok || err != nil {
			return false, err
		}
	}
	return true, nil
}

func (a all) Inject(params map[string]string) (Evaluator, error) {
	var injected []Evaluator
	for _, e := range a.allOf {
		i, err := e.Inject(params)
		if err != nil {
			return nil, err
		}
		injected = append(injected, i)
	}
	return All(injected...), nil
}

func (a all) String() string {
	return ""
}

var _ Evaluator = new(any)

func Any(anyOf ...Evaluator) Evaluator {
	return any{anyOf: anyOf}
}

type any struct {
	anyOf []Evaluator
}

func (a any) Evaluate(permissions map[string]map[string]struct{}) (bool, error) {
	for _, e := range a.anyOf {
		ok, err := e.Evaluate(permissions)
		if err != nil {
			return false, err
		}
		if ok {
			return true, nil
		}
	}
	return false, nil
}

func (a any) Inject(params map[string]string) (Evaluator, error) {
	var injected []Evaluator
	for _, e := range a.anyOf {
		i, err := e.Inject(params)
		if err != nil {
			return nil, err
		}
		injected = append(injected, i)
	}
	return Any(injected...), nil
}

func (a any) String() string {
	return ""
}
