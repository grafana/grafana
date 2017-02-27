package elasticsearch

import "fmt"

var nameIndex = map[string]string{
	"count":          "Count",
	"avg":            "Average",
	"sum":            "Sum",
	"max":            "Max",
	"min":            "Min",
	"extended_stats": "Extended Stats",
	"cardinality":    "Unique Count",
	"moving_avg":     "Moving Average",
	"derivative":     "Derivative",
	"raw_document":   "Raw Document",
}

// Name provides the indivual name storage with refence to parent
type Name struct {
	Value     string
	Reference string
}

// NameMap used to store overriden names from query context
type NameMap map[string]Name

// FilterMap provides the alert query filter status for Metrics; based on visible status on dashboard
type FilterMap map[string]bool

// Hide returns true if a metric should be hidden from check
func (f FilterMap) Hide(key string) bool {
	if hide, ok := f[key]; ok {
		return hide
	}
	return false
}

// GetName returns the complete name, including any referenced names
func (names NameMap) GetName(reference string) string {
	if name, ok := names[reference]; ok {
		if name.Reference != "" {
			if referencedName, ok := names[name.Reference]; ok {
				return fmt.Sprintf("%s %s", name.Value, referencedName.Value)
			}
		}

		return name.Value
	}

	return reference
}

// GetName returns the readable name for the provided metric,
// PipelineAggregates will include a reference to another metric
func (m *Metric) GetName() Name {
	name := Name{}
	if prefix, ok := nameIndex[m.Type]; ok {
		name.Value = fmt.Sprintf("%s", prefix)
	}

	if m.PipelineAggregate == "" {
		name.Value = fmt.Sprintf("%s %s", name.Value, m.Field)
	} else {
		name.Reference = m.Field
	}

	return name
}
