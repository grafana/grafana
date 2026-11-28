package resources

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	"go.yaml.in/yaml/v3"
)

const (
	// maxYAMLNodeDepth bounds nesting. An anchor may reference an ancestor, so a
	// hand-written document could otherwise expand forever.
	maxYAMLNodeDepth = 1000
	// maxYAMLExpandedNodes bounds the total number of values produced by the
	// conversion. Depth alone does not bound alias expansion: nested sequences of
	// repeated anchors stay shallow while multiplying exponentially, so a small
	// file could otherwise exhaust memory during a sync or a file preview.
	maxYAMLExpandedNodes = 1_000_000
)

// yamlToJSON converts a YAML document into JSON, resolving booleans with the
// YAML 1.2 core schema: only true and false are booleans, so the bare words y,
// n, yes, no, on and off stay strings.
//
// The previous decoder went through the Kubernetes YAML serializer, which
// converts YAML with sigs.k8s.io/yaml and therefore resolves the YAML 1.1
// booleans, in keys as well as in values. A dashboard's gridPos key `y` arrived
// as the key "true" and a `refId: N` arrived as false.
//
// That is the only behaviour this function changes. Every other scalar keeps the
// resolution of the previous decoder, including its YAML 1.1-style numeric forms
// such as 0777, which continues to be an integer. Duplicate keys keep the last
// value, merge keys are expanded and only the first document is read, as before.
func yamlToJSON(data []byte) ([]byte, error) {
	var doc yaml.Node
	if err := yaml.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	converter := &yamlNodeConverter{}
	value, err := converter.value(&doc, 0)
	if err != nil {
		return nil, err
	}
	return json.Marshal(value)
}

// yamlNodeConverter walks a parsed document and counts the values it produces,
// so that alias expansion cannot multiply one into an unbounded amount of work.
type yamlNodeConverter struct {
	nodes int
}

func (c *yamlNodeConverter) value(node *yaml.Node, depth int) (any, error) {
	if err := c.enter(depth); err != nil {
		return nil, err
	}
	switch node.Kind {
	case yaml.DocumentNode:
		if len(node.Content) == 0 {
			return nil, nil
		}
		return c.value(node.Content[0], depth+1)
	case yaml.AliasNode:
		if node.Alias == nil {
			return nil, fmt.Errorf("yaml: alias without a target on line %d", node.Line)
		}
		return c.value(node.Alias, depth+1)
	case yaml.SequenceNode:
		seq := make([]any, 0, len(node.Content))
		for _, item := range node.Content {
			value, err := c.value(item, depth+1)
			if err != nil {
				return nil, err
			}
			seq = append(seq, value)
		}
		return seq, nil
	case yaml.MappingNode:
		return c.mapping(node, depth)
	case yaml.ScalarNode:
		return yamlScalarToJSONValue(node)
	default:
		return nil, fmt.Errorf("yaml: unsupported node kind %d on line %d", node.Kind, node.Line)
	}
}

// enter charges one value against the document budget and rejects documents that
// nest too deeply. Every traversal step goes through it, including the ones that
// follow an alias.
func (c *yamlNodeConverter) enter(depth int) error {
	if depth > maxYAMLNodeDepth {
		return fmt.Errorf("yaml: document nesting exceeds %d levels", maxYAMLNodeDepth)
	}
	c.nodes++
	if c.nodes > maxYAMLExpandedNodes {
		return fmt.Errorf("yaml: document expands to more than %d values", maxYAMLExpandedNodes)
	}
	return nil
}

func (c *yamlNodeConverter) mapping(node *yaml.Node, depth int) (map[string]any, error) {
	obj := make(map[string]any, len(node.Content)/2)
	var merges []*yaml.Node
	for i := 0; i+1 < len(node.Content); i += 2 {
		key, value := node.Content[i], node.Content[i+1]
		if key.Tag == "!!merge" {
			merges = append(merges, value)
			continue
		}
		if key.Kind == yaml.AliasNode && key.Alias != nil {
			key = key.Alias
		}
		if key.Kind != yaml.ScalarNode {
			return nil, fmt.Errorf("yaml: mapping key on line %d is not a scalar", key.Line)
		}
		entry, err := c.value(value, depth+1)
		if err != nil {
			return nil, err
		}
		obj[key.Value] = entry
	}
	for _, merge := range merges {
		if err := c.merge(obj, merge, depth+1); err != nil {
			return nil, err
		}
	}
	return obj, nil
}

// merge applies a "<<" key. The mapping's own entries take precedence, so a
// merged entry is used only where the key is not already defined.
func (c *yamlNodeConverter) merge(obj map[string]any, node *yaml.Node, depth int) error {
	if err := c.enter(depth); err != nil {
		return err
	}
	if node.Kind == yaml.AliasNode && node.Alias != nil {
		node = node.Alias
	}
	switch node.Kind {
	case yaml.MappingNode:
		merged, err := c.mapping(node, depth+1)
		if err != nil {
			return err
		}
		for key, value := range merged {
			if _, exists := obj[key]; !exists {
				obj[key] = value
			}
		}
		return nil
	case yaml.SequenceNode:
		for _, item := range node.Content {
			if err := c.merge(obj, item, depth+1); err != nil {
				return err
			}
		}
		return nil
	default:
		return fmt.Errorf("yaml: merge key on line %d is not a mapping or a sequence of mappings", node.Line)
	}
}

func yamlScalarToJSONValue(node *yaml.Node) (any, error) {
	switch node.Tag {
	case "!!null":
		return nil, nil
	case "!!timestamp":
		// YAML 1.2 dropped the timestamp type from the core schema. Keeping the
		// text as written also matches the previous decoder, which did not
		// rewrite a bare 2020-01-01 into 2020-01-01T00:00:00Z.
		return node.Value, nil
	case "!!binary":
		decoded, err := base64.StdEncoding.DecodeString(strings.Join(strings.Fields(node.Value), ""))
		if err != nil {
			return nil, fmt.Errorf("yaml: invalid !!binary value on line %d: %w", node.Line, err)
		}
		return string(decoded), nil
	}
	// Every other tag keeps the resolver the previous decoder used, so only the
	// boolean words above change behaviour.
	var value any
	if err := node.Decode(&value); err != nil {
		return nil, err
	}
	return value, nil
}
