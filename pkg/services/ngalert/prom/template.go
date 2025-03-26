// Package prom contains utilities for working with Prometheus and alert templates.
package prom

import (
	"reflect"
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
	replacements map[string][]string
}

func NewVariableReplacer(replacements map[string]string) *VariableReplacer {
	r := make(map[string][]string, len(replacements))
	for k, v := range replacements {
		// Split the variable into a slice of strings,
		// removing the leading dot if present.
		nv := strings.Split(v, ".")
		if nv[0] == "" {
			nv = nv[1:]
		}
		r[k] = nv
	}

	return &VariableReplacer{
		replacements: r,
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
	tmpPrefix := `{{$value := ""}}{{$labels := ""}}`

	tree, err := p.Parse(tmpPrefix+tmpl, "{{", "}}", map[string]*parse.Tree{})
	if err != nil {
		return "", err
	}

	// Find and replace all variables in the template
	replaced, err := r.walkNodes(tree.Root)
	if err != nil {
		return "", err
	}

	// If no variables were replaced, return the original template
	// to avoid unnecessary changing the template.
	if !replaced {
		return tmpl, nil
	}

	return tree.Root.String()[len(tmpPrefix):], nil
}

// walkNodes recursively traverses the AST to find all variable nodes
// and replaces them with the new values from the replacements map if needed.
func (r *VariableReplacer) walkNodes(node parse.Node) (bool, error) {
	_, replaced := walk(node, r.replacements)
	return replaced, nil
}

func walk(node parse.Node, replacements map[string][]string) (parse.Node, bool) {
	if node == nil || reflect.ValueOf(node).IsNil() {
		return node, false
	}

	var replaced bool

	switch n := node.(type) {
	case *parse.VariableNode:
		return variableNode(n, replacements)
	case *parse.FieldNode:
		return fieldNode(n, replacements)
	case *parse.ActionNode:
		return actionNode(n, replacements)
	case *parse.ChainNode:
		return chainNode(n, replacements)
	case *parse.CommandNode:
		return commandNode(n, replacements)
	case *parse.ListNode:
		return listNode(n, replacements)
	case *parse.PipeNode:
		return pipeNode(n, replacements)
	case *parse.IfNode:
		return ifNode(n, replacements)
	case *parse.RangeNode:
		return rangeNode(n, replacements)
	case *parse.WithNode:
		return withNode(n, replacements)
	case *parse.TemplateNode:
		return templateNode(n, replacements)
	}

	return node, replaced
}

// variableNode handles simple variable nodes, for example `{{ $value }}`.
func variableNode(n *parse.VariableNode, replacements map[string][]string) (parse.Node, bool) {
	if nv, ok := replacements[strings.Join(n.Ident, ".")]; ok {
		return &parse.FieldNode{Ident: nv}, true
	}
	return n, false
}

// fieldNode handles parse.FieldNode nodes, for example `{{ .Value }}`,
// or `{{ $.Value.Something }}`.
func fieldNode(n *parse.FieldNode, replacements map[string][]string) (parse.Node, bool) {
	if len(n.Ident) == 0 {
		return n, false
	}

	var global bool
	var key []string
	if n.Ident[0] == "$" {
		key = n.Ident[1:]
		global = true
	} else {
		key = n.Ident
	}

	if nv, ok := replacements["."+strings.Join(key, ".")]; ok {
		if global {
			n.Ident = append([]string{"$"}, nv...)
		} else {
			n.Ident = nv
		}
		return n, true
	}

	return n, false
}

// actionNode handles parse.ActionNode objects, which represent any `{{ ... }}`
// in the template that isn't a control structure (if/range/with/etc.),
// for example `{{ printf .Name }}`.
//
// We walk the PipeNode inside it to handle any contained variable references.
func actionNode(n *parse.ActionNode, replacements map[string][]string) (parse.Node, bool) {
	pipe, replaced := walk(n.Pipe, replacements)
	n.Pipe = pipe.(*parse.PipeNode)
	return n, replaced
}

// chainNode handles parse.ChainNode objects. A ChainNode is something like
// `(somePipeline).Field`, e.g. `{{ (index .Items 0).Name }}`.
func chainNode(n *parse.ChainNode, replacements map[string][]string) (parse.Node, bool) {
	node, replaced := walk(n.Node, replacements)
	n.Node = node
	return n, replaced
}

// commandNode handles individual commands
// inside pipelines (e.g., `.Name | printf "%s"`) and their arguments.
func commandNode(n *parse.CommandNode, replacements map[string][]string) (parse.Node, bool) {
	replaced := false
	for i, arg := range n.Args {
		newArg, argReplaced := walk(arg, replacements)
		n.Args[i] = newArg
		replaced = replaced || argReplaced
	}
	return n, replaced
}

// listNode handles parse.ListNode objects, for example a block of text
// and actions inside `{{if ...}}...{{end}}`.
func listNode(n *parse.ListNode, replacements map[string][]string) (parse.Node, bool) {
	replaced := false
	for i, child := range n.Nodes {
		newChild, childReplaced := walk(child, replacements)
		n.Nodes[i] = newChild
		replaced = replaced || childReplaced
	}
	return n, replaced
}

// pipeNode handles parse.PipeNode objects, representing a pipeline like
// `{{ .Value | printf "%.2f" }}`. It holds multiple CommandNodes that we walk.
func pipeNode(n *parse.PipeNode, replacements map[string][]string) (parse.Node, bool) {
	replaced := false
	for i, cmd := range n.Cmds {
		newCmd, cmdReplaced := walk(cmd, replacements)
		n.Cmds[i] = newCmd.(*parse.CommandNode)
		replaced = replaced || cmdReplaced
	}
	return n, replaced
}

// ifNode handles parse.IfNode objects, which represent `{{if ...}} ... {{end}}` blocks.
// We walk the pipeline in the 'if', then the 'then' ListNode and then the
// optional 'else' ListNode.
func ifNode(n *parse.IfNode, replacements map[string][]string) (parse.Node, bool) {
	pipe, pipeReplaced := walk(n.Pipe, replacements)
	n.Pipe = pipe.(*parse.PipeNode)

	list, listReplaced := walk(n.List, replacements)
	n.List = list.(*parse.ListNode)

	elseReplaced := false
	if n.ElseList != nil {
		elseList, elseListReplaced := walk(n.ElseList, replacements)
		n.ElseList = elseList.(*parse.ListNode)
		elseReplaced = elseListReplaced
	}

	return n, pipeReplaced || listReplaced || elseReplaced
}

// rangeNode handles parse.RangeNode objects, representing `{{range ...}} ... {{end}}`
// loops. Similar to ifNode, we walk the pipeline, the main ListNode, and the
// optional elseList.
func rangeNode(n *parse.RangeNode, replacements map[string][]string) (parse.Node, bool) {
	pipe, pipeReplaced := walk(n.Pipe, replacements)
	n.Pipe = pipe.(*parse.PipeNode)

	list, listReplaced := walk(n.List, replacements)
	n.List = list.(*parse.ListNode)

	elseReplaced := false
	if n.ElseList != nil {
		elseList, elseListReplaced := walk(n.ElseList, replacements)
		n.ElseList = elseList.(*parse.ListNode)
		elseReplaced = elseListReplaced
	}

	return n, pipeReplaced || listReplaced || elseReplaced
}

// withNode handles parse.WithNode objects, representing `{{with ...}} ... {{end}}`
// blocks. We walk the pipeline, and the contained ListNodes.
func withNode(n *parse.WithNode, replacements map[string][]string) (parse.Node, bool) {
	pipe, pipeReplaced := walk(n.Pipe, replacements)
	n.Pipe = pipe.(*parse.PipeNode)

	list, listReplaced := walk(n.List, replacements)
	n.List = list.(*parse.ListNode)

	elseReplaced := false
	if n.ElseList != nil {
		elseList, elseListReplaced := walk(n.ElseList, replacements)
		n.ElseList = elseList.(*parse.ListNode)
		elseReplaced = elseListReplaced
	}

	return n, pipeReplaced || listReplaced || elseReplaced
}

// templateNode handles `{{template "otherTemplate" .}}`.
// If it has a pipe, we walk that pipe for variable references.
func templateNode(n *parse.TemplateNode, replacements map[string][]string) (parse.Node, bool) {
	replaced := false
	if n.Pipe != nil {
		var p parse.Node
		p, replaced = walk(n.Pipe, replacements)
		n.Pipe = p.(*parse.PipeNode)
	}
	return n, replaced
}
