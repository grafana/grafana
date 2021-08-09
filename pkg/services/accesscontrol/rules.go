package accesscontrol

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
	// Inject params into the evaluator's templated scopes. e.g. "settings:" + eval.Parameters(":id") and returns a new Evaluator
	Inject(params map[string]string) (Evaluator, error)
	// String returns a string representation of permissionEvaluator rules
	String() string
}

var _ Evaluator = new(permissionEvaluator)

// EvalPermission creates a new permission evaluator that will require allEvaluator scopes in combination with action to match
func EvalPermission(action string, scopes ...string) Evaluator {
	return permissionEvaluator{Action: action, Scopes: scopes}
}

type permissionEvaluator struct {
	Action string
	Scopes []string
}

func (p permissionEvaluator) Evaluate(permissions map[string]map[string]struct{}) (bool, error) {
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

func (p permissionEvaluator) Inject(params map[string]string) (Evaluator, error) {
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
	return EvalPermission(p.Action, scopes...), nil
}

func (p permissionEvaluator) String() string {
	b := strings.Builder{}
	b.WriteString("action:")
	b.WriteString(p.Action)
	b.WriteString(" scopes:")
	for i, scope := range p.Scopes {
		if i != 0 {
			b.WriteString(", ")
		}
		b.WriteString(scope)
	}
	return b.String()
}

var _ Evaluator = new(allEvaluator)

func EvalAll(allOf ...Evaluator) Evaluator {
	return allEvaluator{allOf: allOf}
}

type allEvaluator struct {
	allOf []Evaluator
}

func (a allEvaluator) Evaluate(permissions map[string]map[string]struct{}) (bool, error) {
	for _, e := range a.allOf {
		if ok, err := e.Evaluate(permissions); !ok || err != nil {
			return false, err
		}
	}
	return true, nil
}

func (a allEvaluator) Inject(params map[string]string) (Evaluator, error) {
	var injected []Evaluator
	for _, e := range a.allOf {
		i, err := e.Inject(params)
		if err != nil {
			return nil, err
		}
		injected = append(injected, i)
	}
	return EvalAll(injected...), nil
}

func (a allEvaluator) String() string {
	b := strings.Builder{}
	for i, a := range a.allOf {
		if i != 0 {
			b.WriteRune(' ')
		}
		b.WriteString(a.String())
	}
	return b.String()
}

var _ Evaluator = new(anyEvaluator)

func EvalAny(anyOf ...Evaluator) Evaluator {
	return anyEvaluator{anyOf: anyOf}
}

type anyEvaluator struct {
	anyOf []Evaluator
}

func (a anyEvaluator) Evaluate(permissions map[string]map[string]struct{}) (bool, error) {
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

func (a anyEvaluator) Inject(params map[string]string) (Evaluator, error) {
	var injected []Evaluator
	for _, e := range a.anyOf {
		i, err := e.Inject(params)
		if err != nil {
			return nil, err
		}
		injected = append(injected, i)
	}
	return EvalAny(injected...), nil
}

func (a anyEvaluator) String() string {
	b := strings.Builder{}
	for i, a := range a.anyOf {
		if i != 0 {
			b.WriteRune(' ')
		}
		b.WriteString(a.String())
	}
	return b.String()
}
