package prom

import (
	"reflect"
	"strings"
	"text/template/parse"
)

const (
	PrometheusModeTemplateCall = "{{- _prometheusMode -}}"
)

func convertTemplates(m map[string]string) error {
	for k, v := range m {
		nv, err := convertTemplate(v)
		if err != nil {
			return err
		}
		m[k] = nv
	}

	return nil
}

// convertTemplate analyzes a template string to determine if it uses Prometheus-style
// value references ($value or .Value). If it does, it adds a _prometheusMode function call
// to the beginning of the template to switch the template rendering to Prometheus compatibility mode.
// This allows templates converted from Prometheus alerting rules to continue working without modification.
func convertTemplate(tmpl string) (string, error) {
	searchFor := map[string]struct{}{
		"$value":  {},
		".Value":  {},
		"$.Value": {},
	}

	// Create a parser with SkipFuncCheck to avoid errors with unknown functions
	p := parse.New("tmpl")
	p.Mode = parse.ParseComments | parse.SkipFuncCheck

	// Add temporary prefix with the variables that are expected by the template,
	// otherwise the parsing fails.
	tmpPrefix := `{{$value := ""}}{{$labels := ""}}`

	tree, err := p.Parse(tmpPrefix+tmpl, "{{", "}}", map[string]*parse.Tree{})
	if err != nil {
		return "", err
	}

	// Search for the variables in the template
	found := walkNodes(tree.Root, searchFor)
	if found {
		return PrometheusModeTemplateCall + tmpl, nil
	}

	return tmpl, nil
}

// walkNodes recursively traverses the AST to find all variable nodes with certain names
// and returns the boolean indicating whether they are present in the template.
func walkNodes(node parse.Node, searchFor map[string]struct{}) bool {
	var found bool

	var walk func(node parse.Node)
	walk = func(node parse.Node) {
		if node == nil || reflect.ValueOf(node).IsNil() {
			return
		}

		switch n := node.(type) {
		case *parse.VariableNode:
			if _, ok := searchFor[strings.Join(n.Ident, ".")]; ok {
				found = true
			}

		case *parse.FieldNode:
			if _, ok := searchFor["."+strings.Join(n.Ident, ".")]; ok {
				found = true
			}

		case *parse.ActionNode:
			walk(n.Pipe)

		case *parse.ChainNode:
			walk(n.Node)

		case *parse.CommandNode:
			for _, arg := range n.Args {
				walk(arg)
			}

		case *parse.ListNode:
			for _, child := range n.Nodes {
				walk(child)
			}

		case *parse.PipeNode:
			for _, cmd := range n.Cmds {
				walk(cmd)
			}

		case *parse.IfNode:
			walk(n.Pipe)
			walk(n.List)
			if n.ElseList != nil {
				walk(n.ElseList)
			}

		case *parse.RangeNode:
			walk(n.Pipe)
			walk(n.List)
			if n.ElseList != nil {
				walk(n.ElseList)
			}

		case *parse.WithNode:
			walk(n.Pipe)
			walk(n.List)
			if n.ElseList != nil {
				walk(n.ElseList)
			}

		case *parse.TemplateNode:
			if n.Pipe != nil {
				walk(n.Pipe)
			}
		}
	}

	walk(node)

	return found
}
