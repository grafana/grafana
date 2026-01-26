package models

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/alerting/receivers/schema"

	"github.com/grafana/grafana/pkg/util/cmputil"
)

type IntegrationDiffReport struct {
	cmputil.DiffReport
}

// expandPaths recursively collects all sub-paths for keys in the provided map value
func (r IntegrationDiffReport) expandPaths(basePath schema.IntegrationFieldPath, mapVal reflect.Value) []schema.IntegrationFieldPath {
	result := make([]schema.IntegrationFieldPath, 0)
	iter := mapVal.MapRange()
	for iter.Next() {
		keyStr := fmt.Sprintf("%v", iter.Key()) // Assume string keys
		p := basePath.With(keyStr)
		// Recurse if the sub-value is another map
		if m, ok := r.getMap(iter.Value()); ok {
			result = append(result, r.expandPaths(p, m)...)
			continue
		}
		result = append(result, p)
	}
	return result
}

func (r IntegrationDiffReport) getMap(v reflect.Value) (reflect.Value, bool) {
	if v.Kind() == reflect.Map {
		return v, true
	}
	if v.Kind() == reflect.Ptr || v.Kind() == reflect.Interface {
		return r.getMap(v.Elem())
	}
	return reflect.Value{}, false
}

func (r IntegrationDiffReport) needExpand(diff cmputil.Diff) (reflect.Value, bool) {
	ml, lok := r.getMap(diff.Left)
	mr, rok := r.getMap(diff.Right)
	if lok == rok {
		return reflect.Value{}, false
	}
	if lok {
		return ml, true
	}
	return mr, true
}

func (r IntegrationDiffReport) GetSettingsPaths() []schema.IntegrationFieldPath {
	diffs := r.GetDiffsForField("Settings")
	paths := make([]schema.IntegrationFieldPath, 0, len(diffs))
	for _, diff := range diffs {
		// diff.Path has format like Settings[url] or Settings[sub-form][field]
		p := diff.Path
		var path schema.IntegrationFieldPath
		for {
			start := strings.Index(p, "[")
			if start == -1 {
				break
			}
			p = p[start+1:]
			end := strings.Index(p, "]")
			if end == -1 {
				break
			}
			fieldName := p[:end]
			p = p[end+1:]
			path = append(path, fieldName)
		}
		if m, ok := r.needExpand(diff); ok {
			paths = append(paths, r.expandPaths(path, m)...)
			continue
		}
		if len(path) > 0 {
			paths = append(paths, path)
		}
	}
	return paths
}

func (r IntegrationDiffReport) GetSecureSettingsPaths() []schema.IntegrationFieldPath {
	diffs := r.GetDiffsForField("SecureSettings")
	paths := make([]schema.IntegrationFieldPath, 0, len(diffs))
	for _, diff := range diffs {
		if diff.Path == "SecureSettings" {
			if m, ok := r.needExpand(diff); ok {
				paths = append(paths, r.expandPaths(nil, m)...)
			}
			continue
		}
		// diff.Path has format like SecureSettings[field.sub-field.sub]
		p := schema.ParseIntegrationPath(diff.Path[len("SecureSettings[") : len(diff.Path)-1])
		paths = append(paths, p)
	}
	return paths
}

func (integration *Integration) Diff(incoming Integration) IntegrationDiffReport {
	var reporter cmputil.DiffReporter
	var settingsCmp = cmpopts.AcyclicTransformer("settingsMap", func(in map[string]any) map[string]any {
		if in == nil {
			return map[string]any{}
		}
		return in
	})
	var secureCmp = cmpopts.AcyclicTransformer("secureMap", func(in map[string]string) map[string]string {
		if in == nil {
			return map[string]string{}
		}
		return in
	})
	schemaCmp := cmp.Comparer(func(a, b schema.IntegrationSchemaVersion) bool {
		isAZero := reflect.ValueOf(a).IsZero()
		isBZero := reflect.ValueOf(b).IsZero()
		if isAZero && isBZero {
			return true
		}
		if isAZero || isBZero {
			return false
		}
		return a.Type() == b.Type() && a.Version == b.Version
	})
	var cur Integration
	if integration != nil {
		cur = *integration
	}
	cmp.Equal(cur, incoming, cmp.Reporter(&reporter), settingsCmp, secureCmp, schemaCmp)
	return IntegrationDiffReport{DiffReport: reporter.Diffs}
}

// HasReceiversDifferentProtectedFields returns true if the receiver has any protected fields that are different from the incoming receiver.
func HasReceiversDifferentProtectedFields(existing, incoming *Receiver) map[string][]schema.IntegrationFieldPath {
	existingIntegrations := make(map[string]*Integration, len(existing.Integrations))
	for _, integration := range existing.Integrations {
		existingIntegrations[integration.UID] = integration
	}

	var result = make(map[string][]schema.IntegrationFieldPath)
	for _, in := range incoming.Integrations {
		if in.UID == "" {
			continue
		}
		ex, ok := existingIntegrations[in.UID]
		if !ok {
			continue
		}
		paths := HasIntegrationsDifferentProtectedFields(ex, in)
		if len(paths) > 0 {
			result[in.UID] = paths
		}
	}
	return result
}

// HasIntegrationsDifferentProtectedFields returns list of paths to protected fields that are different between two integrations.
func HasIntegrationsDifferentProtectedFields(existing, incoming *Integration) []schema.IntegrationFieldPath {
	diff := existing.Diff(*incoming)
	// The incoming receiver always has both secret and non-secret fields in Settings.
	// So, if it's specified and happens to be sensitive, we consider it changed
	var result []schema.IntegrationFieldPath
	settingsDiff := diff.GetSettingsPaths()
	for _, path := range settingsDiff {
		if incoming.Config.IsProtectedField(path) {
			result = append(result, path)
		}
	}
	return result
}
