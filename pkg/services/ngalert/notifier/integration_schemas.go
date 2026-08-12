package notifier

import "github.com/grafana/alerting/receivers/schema"

// ApplyAllowedIntegrations flips CanCreate to false on every version of any integration whose type is not present in allowed.
// It returns schemas unchanged when allowed is nil.
// Versions slices are cloned so the shared schema registry returned by notify.GetSchemaForAllIntegrations is not mutated.
func ApplyAllowedIntegrations(schemas []schema.IntegrationTypeSchema, allowed map[schema.IntegrationType]struct{}) []schema.IntegrationTypeSchema {
	if allowed == nil {
		return schemas
	}
	for i, s := range schemas {
		if _, ok := allowed[s.Type]; ok {
			continue
		}
		cloned := make([]schema.IntegrationSchemaVersion, len(s.Versions))
		for j, v := range s.Versions {
			v.CanCreate = false
			cloned[j] = v
		}
		schemas[i].Versions = cloned
	}
	return schemas
}
