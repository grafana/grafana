package search

import (
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"

	rulesmanifest "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/manifestdata"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const (
	ruleTypeAlerting  = "alertrule"
	ruleTypeRecording = "recordingrule"
)

type perKindFieldSet struct {
	byName map[string]resource.SearchFieldDefinition
}

type perKindResolvedField struct {
	definition resource.SearchFieldDefinition
	name       string
	mapKey     string
}

func (s *perKindFieldSet) resolvePredicateField(name string) (perKindResolvedField, bool, error) {
	if def, ok := s.byName[name]; ok {
		return perKindResolvedField{definition: def, name: name}, true, nil
	}
	var match perKindResolvedField
	for parent, def := range s.byName {
		if def.Type != resource.SearchFieldTypeStringMap || !strings.HasPrefix(name, parent+".") || len(parent) <= len(match.name) {
			continue
		}
		match = perKindResolvedField{definition: def, name: parent, mapKey: strings.TrimPrefix(name, parent+".")}
	}
	if match.name == "" {
		return perKindResolvedField{}, false, nil
	}
	if match.mapKey == "" {
		return perKindResolvedField{}, true, fmt.Errorf("map key must not be empty")
	}
	if strings.Contains(match.mapKey, "=") {
		return perKindResolvedField{}, true, fmt.Errorf("map key must not contain '='")
	}
	return match, true, nil
}

func (s *perKindFieldSet) has(name string, c resource.SearchCapability) bool {
	def, ok := s.byName[name]
	return ok && def.HasCapability(c)
}

func (s *perKindFieldSet) known(name string) bool {
	_, ok := s.byName[name]
	return ok
}

var perKindFieldSets = buildPerKindFieldSets()

func buildPerKindFieldSets() map[schema.GroupResource]*perKindFieldSet {
	provider := resource.NewManifestBackedProvider(rulesmanifest.LocalManifest().ManifestData)
	out := map[schema.GroupResource]*perKindFieldSet{}
	for _, gr := range []schema.GroupResource{
		alertrule.ResourceInfo.GroupResource(),
		recordingrule.ResourceInfo.GroupResource(),
	} {
		byName := map[string]resource.SearchFieldDefinition{}
		for _, d := range resource.StandardSearchFieldDefinitions() {
			byName[d.Name] = d
		}
		gvr := schema.GroupVersionResource{Group: gr.Group, Resource: gr.Resource}
		for _, d := range provider.Fields(gvr) {
			byName[d.Name] = d
		}
		out[gr] = &perKindFieldSet{byName: byName}
	}
	return out
}
