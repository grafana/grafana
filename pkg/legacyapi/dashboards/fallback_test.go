package dashboards

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
)

type fakeVersions struct {
	objs  map[string]*unstructured.Unstructured
	errs  map[string]error
	reads []string
}

func (f *fakeVersions) get(_ context.Context, version string) (*unstructured.Unstructured, error) {
	f.reads = append(f.reads, version)
	if err := f.errs[version]; err != nil {
		return nil, err
	}
	return f.objs[version], nil
}

func versionObj(version string) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{"apiVersion": "dashboard.grafana.app/" + version}}
}

func conversionFailed(storedVersion, msg string) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"status": map[string]any{"conversion": map[string]any{"failed": true, "storedVersion": storedVersion, "error": msg}},
	}}
}

func TestGetWithFallback(t *testing.T) {
	errRead := errors.New("read failed")

	cases := []struct {
		name      string
		requested string
		objs      map[string]*unstructured.Unstructured
		errs      map[string]error
		wantReads []string
		wantObj   string
		wantErr   error
		wantFalls []Fallback
	}{
		{
			name:      "default version",
			objs:      map[string]*unstructured.Unstructured{DefaultAPIVersion: versionObj(DefaultAPIVersion)},
			wantReads: []string{DefaultAPIVersion},
			wantObj:   DefaultAPIVersion,
		},
		{
			name:      "requested version",
			requested: "v2beta1",
			objs:      map[string]*unstructured.Unstructured{"v2beta1": versionObj("v2beta1")},
			wantReads: []string{"v2beta1"},
			wantObj:   "v2beta1",
		},
		{
			name:      "requested version fails",
			requested: "v2beta1",
			objs:      map[string]*unstructured.Unstructured{DefaultAPIVersion: versionObj(DefaultAPIVersion)},
			errs:      map[string]error{"v2beta1": errRead},
			wantReads: []string{"v2beta1", DefaultAPIVersion},
			wantObj:   DefaultAPIVersion,
			wantFalls: []Fallback{{Version: DefaultAPIVersion, Err: errRead}},
		},
		{
			name: "conversion failed",
			objs: map[string]*unstructured.Unstructured{
				DefaultAPIVersion: conversionFailed("v2alpha1", "cannot convert"),
				"v2alpha1":        versionObj("v2alpha1"),
			},
			wantReads: []string{DefaultAPIVersion, "v2alpha1"},
			wantObj:   "v2alpha1",
			wantFalls: []Fallback{{Version: "v2alpha1", ConversionError: "cannot convert"}},
		},
		{
			name:      "conversion failed at the requested version",
			requested: "v2beta1",
			objs: map[string]*unstructured.Unstructured{
				"v2beta1":  conversionFailed("v2alpha1", "cannot convert"),
				"v2alpha1": versionObj("v2alpha1"),
			},
			wantReads: []string{"v2beta1", "v2alpha1"},
			wantObj:   "v2alpha1",
			wantFalls: []Fallback{{Version: "v2alpha1", ConversionError: "cannot convert"}},
		},
		{
			name:      "default version fails",
			errs:      map[string]error{DefaultAPIVersion: errRead},
			wantReads: []string{DefaultAPIVersion},
			wantErr:   errRead,
		},
		{
			name:      "stored version fails",
			objs:      map[string]*unstructured.Unstructured{DefaultAPIVersion: conversionFailed("v2alpha1", "cannot convert")},
			errs:      map[string]error{"v2alpha1": errRead},
			wantReads: []string{DefaultAPIVersion, "v2alpha1"},
			wantErr:   errRead,
			wantFalls: []Fallback{{Version: "v2alpha1", ConversionError: "cannot convert"}},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			versions := &fakeVersions{objs: tc.objs, errs: tc.errs}
			var falls []Fallback

			obj, err := GetWithFallback(t.Context(), tc.requested, versions.get, func(f Fallback) { falls = append(falls, f) })

			assert.Equal(t, tc.wantReads, versions.reads)
			assert.Equal(t, tc.wantFalls, falls)
			if tc.wantErr != nil {
				require.ErrorIs(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, "dashboard.grafana.app/"+tc.wantObj, obj.GetAPIVersion())
		})
	}

	t.Run("nil callback", func(t *testing.T) {
		versions := &fakeVersions{
			objs: map[string]*unstructured.Unstructured{DefaultAPIVersion: versionObj(DefaultAPIVersion)},
			errs: map[string]error{"v2beta1": errRead},
		}
		_, err := GetWithFallback(t.Context(), "v2beta1", versions.get, nil)
		require.NoError(t, err)
	})
}

func TestConversionStatus(t *testing.T) {
	tests := []struct {
		name                  string
		obj                   *unstructured.Unstructured
		expectedFailed        bool
		expectedStoredVersion string
		expectedError         string
	}{
		{
			name: "No status field",
			obj: &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "test"},
			}},
			expectedFailed:        false,
			expectedStoredVersion: "",
			expectedError:         "",
		},
		{
			name: "Status field, but no conversion field",
			obj: &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "test"},
				"status":   map[string]interface{}{"someOtherStatus": "ok"},
			}},
			expectedFailed:        false,
			expectedStoredVersion: "",
			expectedError:         "",
		},
		{
			name: "Conversion field, failed=true, with storedVersion and error",
			obj: &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "test"},
				"status": map[string]interface{}{
					"conversion": map[string]interface{}{
						"failed":        true,
						"storedVersion": v2alpha1.VERSION,
						"error":         "conversion failed",
					},
				},
			}},
			expectedFailed:        true,
			expectedStoredVersion: "v2alpha1",
			expectedError:         "conversion failed",
		},
		{
			name: "Conversion field, failed=false",
			obj: &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "test"},
				"status": map[string]interface{}{
					"conversion": map[string]interface{}{
						"failed":        false,
						"storedVersion": "v1alpha1",
						"error":         "",
					},
				},
			}},
			expectedFailed:        false,
			expectedStoredVersion: "v1alpha1",
			expectedError:         "",
		},
		{
			name: "Conversion field, missing failed (defaults to false)",
			obj: &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "test"},
				"status": map[string]interface{}{
					"conversion": map[string]interface{}{

						"storedVersion": "v1alpha1",
						"error":         "",
					},
				},
			}},
			expectedFailed:        false,
			expectedStoredVersion: "v1alpha1",
			expectedError:         "",
		},
		{
			name: "Conversion field, failed=true, missing storedVersion",
			obj: &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "test"},
				"status": map[string]interface{}{
					"conversion": map[string]interface{}{
						"failed": true,

						"error": "conversion failed",
					},
				},
			}},
			expectedFailed:        true,
			expectedStoredVersion: "",
			expectedError:         "conversion failed",
		},
		{
			name: "Conversion field, failed=true, missing error",
			obj: &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "test"},
				"status": map[string]interface{}{
					"conversion": map[string]interface{}{
						"failed":        true,
						"storedVersion": v2alpha1.VERSION,
					},
				},
			}},
			expectedFailed:        true,
			expectedStoredVersion: "v2alpha1",
			expectedError:         "",
		},
		{
			name:                  "Empty object",
			obj:                   &unstructured.Unstructured{Object: map[string]interface{}{}},
			expectedFailed:        false,
			expectedStoredVersion: "",
			expectedError:         "",
		},
		{
			name:                  "Nil object",
			obj:                   nil,
			expectedFailed:        false,
			expectedStoredVersion: "",
			expectedError:         "",
		},
		{
			name: "Status not a map",
			obj: &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "test"},
				"status":   "not a map",
			}},
			expectedFailed:        false,
			expectedStoredVersion: "",
			expectedError:         "",
		},
		{
			name: "Conversion not a map",
			obj: &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "test"},
				"status": map[string]interface{}{
					"conversion": "not a map",
				},
			}},
			expectedFailed:        false,
			expectedStoredVersion: "",
			expectedError:         "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var input *unstructured.Unstructured
			if tt.obj != nil {
				input = tt.obj.DeepCopy()
			} else {
				input = &unstructured.Unstructured{Object: map[string]interface{}{}}
			}

			failed, storedVersion, conversionErr := ConversionStatus(input)
			require.Equal(t, tt.expectedFailed, failed, "failed mismatch")
			require.Equal(t, tt.expectedStoredVersion, storedVersion, "storedVersion mismatch")
			require.Equal(t, tt.expectedError, conversionErr, "conversionErr mismatch")
		})
	}
}
