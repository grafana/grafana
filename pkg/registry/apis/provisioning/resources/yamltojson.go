package resources

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	"go.yaml.in/yaml/v3"
)

// maxYAMLNodeDepth bounds the recursion below. Anchors may reference an
// ancestor, so a hand-written file could otherwise expand forever.
const maxYAMLNodeDepth = 1000

// yamlToJSON converts a YAML document into JSON using the YAML 1.2 core schema.
//
// The Kubernetes YAML serializer that DecodeYAMLObject used previously converts
// YAML with sigs.k8s.io/yaml, which resolves the YAML 1.1 booleans. YAML 1.1
// reads the bare words y, n, yes, no, on and off as booleans, in keys as well
// as values, so a dashboard's gridPos key `y` arrived as the key "true" and a
// `refId: N` arrived as false. YAML 1.2 only knows true and false, which is
// what authors of dashboards and alert rules expect.
//
// Scalars are therefore resolved by go.yaml.in/yaml/v3, while everything else
// stays as close as possible to the previous decoder: duplicate keys keep the
// last value, merge keys are expanded, non-scalar mapping keys are rejected and
// timestamps keep the text that was written instead of being re-encoded.
func yamlToJSON(data []byte) ([]byte, error) {
	var doc yaml.Node
	if err := yaml.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	value, err := yamlNodeToJSONValue(&doc, 0)
	if err != nil {
		return nil, err
	}
	return json.Marshal(value)
}

func yamlNodeToJSONValue(node *yaml.Node, depth int) (any, error) {
	if depth > maxYAMLNodeDepth {
		return nil, fmt.Errorf("yaml: document nesting exceeds %d levels", maxYAMLNodeDepth)
	}
	switch node.Kind {
	case yaml.DocumentNode:
		if len(node.Content) == 0 {
			return nil, nil
		}
		return yamlNodeToJSONValue(node.Content[0], depth+1)
	case yaml.AliasNode:
		if node.Alias == nil {
			return nil, fmt.Errorf("yaml: alias without a target on line %d", node.Line)
		}
		return yamlNodeToJSONValue(node.Alias, depth+1)
	case yaml.SequenceNode:
		seq := make([]any, 0, len(node.Content))
		for _, item := range node.Content {
			value, err := yamlNodeToJSONValue(item, depth+1)
			if err != nil {
				return nil, err
			}
			seq = append(seq, value)
		}
		return seq, nil
	case yaml.MappingNode:
		return yamlMappingToJSONValue(node, depth)
	case yaml.ScalarNode:
		return yamlScalarToJSONValue(node)
	default:
		return nil, fmt.Errorf("yaml: unsupported node kind %d on line %d", node.Kind, node.Line)
	}
}

// yamlMappingToJSONValue converts a mapping into a JSON object. Entries merged
// through a "<<" key are added only where the mapping does not define the key,
// because the mapping's own entries take precedence.
func yamlMappingToJSONValue(node *yaml.Node, depth int) (map[string]any, error) {
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
		entry, err := yamlNodeToJSONValue(value, depth+1)
		if err != nil {
			return nil, err
		}
		obj[key.Value] = entry
	}
	for _, merge := range merges {
		if err := yamlMergeInto(obj, merge, depth); err != nil {
			return nil, err
		}
	}
	return obj, nil
}

func yamlMergeInto(obj map[string]any, merge *yaml.Node, depth int) error {
	if merge.Kind == yaml.AliasNode && merge.Alias != nil {
		merge = merge.Alias
	}
	switch merge.Kind {
	case yaml.MappingNode:
		merged, err := yamlMappingToJSONValue(merge, depth+1)
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
		for _, item := range merge.Content {
			if err := yamlMergeInto(obj, item, depth+1); err != nil {
				return err
			}
		}
		return nil
	default:
		return fmt.Errorf("yaml: merge key on line %d is not a mapping or a sequence of mappings", merge.Line)
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
	var value any
	if err := node.Decode(&value); err != nil {
		return nil, err
	}
	return value, nil
}
