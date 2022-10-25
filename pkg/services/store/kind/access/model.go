package access

import (
	"fmt"
	"sort"
)

type FolderAccessRule struct {
	Action string `json:"action"` // read, write, execute, none, etc
	Kind   string `json:"kind"`   // default *
	Who    string `json:"who"`    // users and groups
}

func (f *FolderAccessRule) key() string {
	return fmt.Sprintf("%s/%s/%s", f.Action, f.Kind, f.Who)
}

type FolderAccessRules struct {
	Rules []FolderAccessRule `json:"rules"`
}

func Sanitize(v FolderAccessRules) (FolderAccessRules, error) {
	found := make(map[string]bool)
	out := FolderAccessRules{}
	for idx := range v.Rules {
		rule := v.Rules[idx]
		if rule.Action == "" {
			return out, fmt.Errorf("missing action")
		}
		if rule.Who == "" {
			return out, fmt.Errorf("missing who")
		}
		if rule.Kind == "" {
			rule.Kind = "*"
		}
		key := rule.key()
		if found[key] {
			continue // duplicate value
		}
		found[key] = true
		out.Rules = append(out.Rules, rule)
	}

	sort.Slice(out.Rules, func(i, j int) bool {
		return out.Rules[i].key() < out.Rules[j].key()
	})

	return out, nil
}

type KindAccessInfo struct {
	Action string `json:"action"` // read, write, execute

	Kind map[string]KindAccessInfoX `json:"kind"` // * is all kinds
}

type KindAccessInfoX struct {
	No  []string `json:"block,omitempty"` // blocked prefix
	Yes []string `json:"prefix"`          // OK prefixes
}
