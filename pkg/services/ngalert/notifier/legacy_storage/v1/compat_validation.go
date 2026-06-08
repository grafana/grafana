package v1

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/alerting/definition"
	"github.com/grafana/alerting/definition/compat"
	"github.com/prometheus/alertmanager/config"
)

// findUnsupportedReceiverFields returns the YAML paths of upstream receiver fields
// that don't survive conversion to Grafana's definition format and would be
// silently dropped (e.g. the *_file / *_ref fields removed in grafana/alerting#573).
// It diffs orig against a round-trip of def, so it stays correct as upstream adds
// fields.
func findUnsupportedReceiverFields(orig config.Receiver, def definition.Receiver) (fields []string, err error) {
	roundTripped := compat.DefinitionReceiverToUpstreamReceiver(def)

	var reporter yamlPathReporter
	// cmp.Diff can panic on inputs it cannot compare; turn that into an error so
	// it can't crash the import.
	defer func() {
		if rec := recover(); rec != nil {
			err = fmt.Errorf("failed to compare receiver %q: %v", orig.Name, rec)
		}
	}()

	// Exporter: upstream config types have unexported fields go-cmp would panic on.
	// EquateEmpty: don't report nil vs empty as a difference.
	cmp.Diff(orig, roundTripped,
		cmp.Exporter(func(reflect.Type) bool { return true }),
		cmpopts.EquateEmpty(),
		cmp.Reporter(&reporter),
	)
	return reporter.paths, nil
}

// yamlPathReporter is a go-cmp reporter that records differing values by their
// YAML path (e.g. email_configs[0].auth_password_file) rather than Go field names.
type yamlPathReporter struct {
	path  cmp.Path
	paths []string
}

func (r *yamlPathReporter) PushStep(ps cmp.PathStep) { r.path = append(r.path, ps) }
func (r *yamlPathReporter) PopStep()                 { r.path = r.path[:len(r.path)-1] }

func (r *yamlPathReporter) Report(rs cmp.Result) {
	if rs.Equal() {
		return
	}
	var b strings.Builder
	for i, s := range r.path {
		switch s := s.(type) {
		case cmp.StructField:
			if b.Len() > 0 {
				b.WriteByte('.')
			}
			b.WriteString(yamlFieldName(r.path[i-1].Type(), s))
		case cmp.SliceIndex:
			if k := s.Key(); k >= 0 {
				fmt.Fprintf(&b, "[%d]", k)
			}
		case cmp.MapIndex:
			fmt.Fprintf(&b, "[%v]", s.Key())
		}
	}
	r.paths = append(r.paths, b.String())
}

// yamlFieldName returns the field's YAML tag name, falling back to the Go field
// name when the parent isn't a struct or the field has no usable yaml tag.
func yamlFieldName(parent reflect.Type, sf cmp.StructField) string {
	for parent != nil && parent.Kind() == reflect.Pointer {
		parent = parent.Elem()
	}
	if parent != nil && parent.Kind() == reflect.Struct && sf.Index() < parent.NumField() {
		tag := parent.Field(sf.Index()).Tag.Get("yaml")
		if name, _, _ := strings.Cut(tag, ","); name != "" && name != "-" {
			return name
		}
	}
	return sf.Name()
}
