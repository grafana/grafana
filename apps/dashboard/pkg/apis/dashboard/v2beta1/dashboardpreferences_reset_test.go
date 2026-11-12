package v2beta1_test

import (
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	manifestdata "github.com/grafana/grafana/apps/dashboard/pkg/apis"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// ResetPath is written out by hand, so a field added to the spec without a path could not be reset.
func TestDashboardPreferencesResetPathsMatchSpecFields(t *testing.T) {
	var fields []string
	collectDashboardPreferencesFields(reflect.TypeFor[dashv2beta1.DashboardPreferencesSpec](), "", &fields)
	slices.Sort(fields)

	gvk := dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionKind()
	var paths []string
	var maxItems uint64
	for _, version := range manifestdata.LocalManifest().ManifestData.Versions {
		if version.Name != gvk.Version {
			continue
		}
		for _, kind := range version.Kinds {
			if kind.Kind != gvk.Kind {
				continue
			}
			crd, err := kind.Schema.AsCRDOpenAPI3(gvk.Kind)
			require.NoError(t, err)
			reset := crd.Properties["spec"].Value.Properties["reset"].Value
			require.NotNil(t, reset.MaxItems)
			maxItems = *reset.MaxItems
			for _, value := range reset.Items.Value.Enum {
				paths = append(paths, value.(string))
			}
		}
	}
	slices.Sort(paths)

	require.Equal(t, fields, paths)
	require.GreaterOrEqual(t, maxItems, uint64(len(paths)), "a reset of every field must fit in the list")
}

// A struct with no optional member, such as timeRange, is set as a whole, so it is one field.
func collectDashboardPreferencesFields(typ reflect.Type, prefix string, fields *[]string) {
	for i := range typ.NumField() {
		field := typ.Field(i)
		name, _, _ := strings.Cut(field.Tag.Get("json"), ",")
		if prefix == "" && name == "reset" {
			continue
		}

		fieldType := field.Type
		if fieldType.Kind() == reflect.Pointer {
			fieldType = fieldType.Elem()
		}
		if fieldType.Kind() == reflect.Struct && hasOptionalMember(fieldType) {
			collectDashboardPreferencesFields(fieldType, prefix+name+".", fields)
			continue
		}
		*fields = append(*fields, prefix+name)
	}
}

func hasOptionalMember(typ reflect.Type) bool {
	for i := range typ.NumField() {
		if typ.Field(i).Type.Kind() == reflect.Pointer {
			return true
		}
	}
	return false
}
