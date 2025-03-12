// Package prom contains utilities for working with Prometheus and alert templates.
package prom

import (
	"reflect"
	"sort"
	"strings"
	"text/template/parse"
)

// VariableReplacer is responsible for replacing template variables with specified values.
//
// Examples:
//
//	// Initialize a replacer that transforms template variables
//	replacer := NewVariableReplacer(map[string]string{
//	    "Value": ".Values.query.Value",
//	    "Name":  ".Values.query.Name",
//	})
//
//	// Example 1: Simple variable replacement
//	templates := map[string]string{
//	    "greeting": "Hello {{ .Name }}",
//	}
//	replacer.Replace(templates)
//	// templates now contains:
//		{"greeting": "Hello {{ .Values.query.Name }}"}
//
//
//	// Example 2: Multiple variables and control structures
//	templates := map[string]string{
//	    "message": "{{ if eq .Value 10 }}High value{{ else }}Low value{{ end }}",
//	}
//	replacer.Replace(templates)
//	// templates now contains:
//		{"message": "{{ if eq .Values.query.Value 10 }}High value{{ else }}Low value{{ end }}"}
type VariableReplacer struct {
	replacements map[string]string
}

func NewVariableReplacer(replacements map[string]string) *VariableReplacer {
	return &VariableReplacer{
		replacements: replacements,
	}
}

// Replace processes a map of template strings, replacing variables according to the
// replacer's configuration and updating the map in place.
func (r *VariableReplacer) Replace(m map[string]string) error {
	if m == nil {
		return nil
	}

	for k, v := range m {
		nv, err := r.replaceVariables(v)
		if err != nil {
			return err
		}
		m[k] = nv
	}
	return nil
}

// replaceVariables processes a single template string, replacing all variables
// according to the replacer's configuration.
func (r *VariableReplacer) replaceVariables(tmpl string) (string, error) {
	// Create a parser with SkipFuncCheck to avoid errors with unknown functions
	p := parse.New("tmpl")
	p.Mode = parse.ParseComments | parse.SkipFuncCheck

	// Add temporary prefix with the variables that are expected by the template,
	// otherwise the parsing fails.
	tmpPrefix := `{{- $value := "" -}}{{- $labels := "" -}}`
	tmpl = tmpPrefix + tmpl

	tree, err := p.Parse(tmpl, "{{", "}}", map[string]*parse.Tree{})
	if err != nil {
		return "", err
	}

	// Find all variable nodes
	nodes, err := r.walkNodes(tree.Root)
	if err != nil {
		return "", err
	}

	// Sort nodes by position in the template string
	// to process them in order
	sort.Slice(nodes, func(i, j int) bool {
		return nodes[i].Pos < nodes[j].Pos
	})

	// Construct the new template string by replacing variables
	var result strings.Builder
	pos := 0
	for _, n := range nodes {
		if new, ok := r.replacements[n.Ident]; ok {
			// Add text up to this variable
			result.WriteString(tmpl[pos:n.Pos])
			// Add the replacement
			result.WriteString(new)
			// Update position in the original template to the end of the variable
			pos = n.Pos + len(n.Ident)
		}
	}

	// Add any remaining text after the last processed variable
	if pos < len(tmpl) {
		result.WriteString(tmpl[pos:])
	}

	resultTmpl := result.String()[len(tmpPrefix):]

	return resultTmpl, nil
}

// variableNode represents a variable in a template with its position.
type variableNode struct {
	Pos   int    // Position in the template string
	Ident string // Name of the variable
}

// walkNodes recursively traverses the AST to find all variable nodes.
// It returns a slice of variable nodes found in the tree.
func (r *VariableReplacer) walkNodes(root parse.Node) ([]*variableNode, error) {
	var err error
	result := []*variableNode{}

	var walk func(node parse.Node)
	walk = func(node parse.Node) {
		if node == nil || reflect.ValueOf(node).IsNil() {
			return
		}

		switch n := node.(type) {
		// Variable nodes
		case *parse.VariableNode:
			if len(n.Ident) > 0 {
				v := &variableNode{
					Pos:   int(n.Pos),
					Ident: strings.Join(n.Ident, "."),
				}
				result = append(result, v)
			}
		case *parse.FieldNode:
			if len(n.Ident) > 0 {
				v := &variableNode{
					Pos: int(n.Pos),
					// Preprend the dot to the variable name if it's a field variable
					// to match it with the template.
					Ident: "." + strings.Join(n.Ident, "."),
				}
				result = append(result, v)
			}

		// Nodes with args
		case *parse.ActionNode:
			walk(n.Pipe)
		case *parse.ChainNode:
			walk(n.Node)
		case *parse.CommandNode:
			for _, arg := range n.Args {
				walk(arg)
			}
		case *parse.ListNode:
			for _, node := range n.Nodes {
				walk(node)
			}
		case *parse.PipeNode:
			for _, cmd := range n.Cmds {
				walk(cmd)
			}

		// Control structure nodes
		case *parse.IfNode:
			walk(n.Pipe)
			walk(n.List)
			walk(n.ElseList)
		case *parse.RangeNode:
			walk(n.Pipe)
			walk(n.List)
			walk(n.ElseList)
		case *parse.WithNode:
			walk(n.Pipe)
			walk(n.List)
			walk(n.ElseList)
		case *parse.BranchNode:
			walk(n.Pipe)
			walk(n.List)
			walk(n.ElseList)
		case *parse.TemplateNode:
			walk(n.Pipe)
		}
	}

	walk(root)
	return result, err
}
