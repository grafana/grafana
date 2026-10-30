package dashboard

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/admission"
	requestcontext "k8s.io/apiserver/pkg/endpoints/request"

	authlib "github.com/grafana/authlib/types"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apiserverbuilder "github.com/grafana/grafana/pkg/services/apiserver/builder"
	settingservice "github.com/grafana/grafana/pkg/services/setting"
)

type fakeSettingService struct {
	settings []*settingservice.Setting
	err      error

	calls     int
	namespace string
	selector  metav1.LabelSelector
}

func (f *fakeSettingService) Describe(chan<- *prometheus.Desc) {}
func (f *fakeSettingService) Collect(chan<- prometheus.Metric) {}

func (f *fakeSettingService) ListAsIni(context.Context, metav1.LabelSelector) (*ini.File, error) {
	return nil, errors.New("not implemented")
}

func (f *fakeSettingService) List(ctx context.Context, selector metav1.LabelSelector) ([]*settingservice.Setting, error) {
	f.calls++
	f.namespace = requestcontext.NamespaceValue(ctx)
	f.selector = selector
	return f.settings, f.err
}

func minRefreshIntervalSetting(value string) []*settingservice.Setting {
	return []*settingservice.Setting{{Section: "dashboards", Key: "min_refresh_interval", Value: value}}
}

// A nil fake must reach the builder as a nil interface; the builder skips the lookup only then.
func newBuilderWithSettings(service *fakeSettingService) *DashboardsAPIBuilder {
	var settings settingservice.Service
	if service != nil {
		settings = service
	}
	return NewAPIService(authlib.FixedAccessClient(true), nil, testutil.NewDataSourceProvider(testutil.StandardTestConfig), testutil.NewLibraryElementProvider(), nil, nil, nil, settings)
}

func TestDashboardAPIBuilder_MinRefreshIntervalFor(t *testing.T) {
	tests := []struct {
		name     string
		service  *fakeSettingService
		expected string
	}{
		{
			name:     "when there is no settings service, returns the default 5s",
			expected: "5s",
		},
		{
			name:     "when the stored floor in settings service is 1s, returns 1s",
			service:  &fakeSettingService{settings: minRefreshIntervalSetting("1s")},
			expected: "1s",
		},
		{
			name:     "when the stored floor in settings service is 5m, returns 5m",
			service:  &fakeSettingService{settings: minRefreshIntervalSetting("5m")},
			expected: "5m",
		},
		{
			name:     "when the stored value is blank, returns the default 5s",
			service:  &fakeSettingService{settings: minRefreshIntervalSetting("  ")},
			expected: "5s",
		},
		{
			name:     "when the stack has no override, returns the default 5s",
			service:  &fakeSettingService{},
			expected: "5s",
		},
		{
			name: "when only other settings come back, returns the default 5s",
			service: &fakeSettingService{settings: []*settingservice.Setting{
				{Section: "dashboards", Key: "default_home_dashboard_path", Value: "1s"},
				{Section: "security", Key: "min_refresh_interval", Value: "1s"},
			}},
			expected: "5s",
		},
		{
			name:     "when the stored value is invalid, returns the default 5s",
			service:  &fakeSettingService{settings: minRefreshIntervalSetting("soon")},
			expected: "5s",
		},
		{
			name:     "when the lookup fails, returns the default 5s",
			service:  &fakeSettingService{err: errors.New("settings service unavailable")},
			expected: "5s",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := newBuilderWithSettings(tt.service)

			require.Equal(t, tt.expected, b.minRefreshIntervalFor(context.Background(), "stacks-1"))

			if tt.service != nil {
				require.Equal(t, 1, tt.service.calls)
				require.Equal(t, "stacks-1", tt.service.namespace)
				require.Equal(t, metav1.LabelSelector{MatchLabels: map[string]string{
					"section": "dashboards",
					"key":     "min_refresh_interval",
					"source":  "us",
				}}, tt.service.selector)
			}
		})
	}
}

func TestDashboardAPIBuilder_RefreshIntervalAdmission(t *testing.T) {
	requester := &identity.StaticRequester{
		Type:      authlib.TypeUser,
		UserID:    1,
		UserUID:   "user-1",
		OrgID:     1,
		Namespace: "stacks-1",
	}

	tests := []struct {
		name            string
		service         *fakeSettingService
		refresh         string
		expectedTooLow  bool
		expectedLookups int
	}{
		{
			name:    "when there is no settings service, applies the default 5s floor and accepts 5s",
			refresh: "5s",
		},
		{
			name:           "when there is no settings service, applies the default 5s floor and refuses 4s",
			refresh:        "4s",
			expectedTooLow: true,
		},
		{
			name:    "when refresh is empty, accepts it without a lookup",
			service: &fakeSettingService{settings: minRefreshIntervalSetting("5m")},
			refresh: "",
		},
		{
			name:    "when refresh is auto, accepts it without a lookup",
			service: &fakeSettingService{settings: minRefreshIntervalSetting("5m")},
			refresh: "auto",
		},
		{
			name:            "when the floor is 1s, accepts 2s",
			service:         &fakeSettingService{settings: minRefreshIntervalSetting("1s")},
			refresh:         "2s",
			expectedLookups: 1,
		},
		{
			name:            "when the floor is 5m, refuses 10s",
			service:         &fakeSettingService{settings: minRefreshIntervalSetting("5m")},
			refresh:         "10s",
			expectedTooLow:  true,
			expectedLookups: 1,
		},
		{
			name:            "when the floor is 5m, accepts 5m",
			service:         &fakeSettingService{settings: minRefreshIntervalSetting("5m")},
			refresh:         "5m",
			expectedLookups: 1,
		},
		{
			name:            "when the lookup fails, applies the default 5s floor and accepts 5s",
			service:         &fakeSettingService{err: errors.New("settings service unavailable")},
			refresh:         "5s",
			expectedLookups: 1,
		},
		{
			name:            "when the lookup fails, applies the default 5s floor and refuses 4s",
			service:         &fakeSettingService{err: errors.New("settings service unavailable")},
			refresh:         "4s",
			expectedTooLow:  true,
			expectedLookups: 1,
		},
	}

	for _, operation := range []admission.Operation{admission.Create, admission.Update} {
		for _, tt := range tests {
			t.Run(fmt.Sprintf("%s/%s", operation, tt.name), func(t *testing.T) {
				var service *fakeSettingService
				if tt.service != nil {
					fake := *tt.service
					service = &fake
				}
				b := newBuilderWithSettings(service)
				admissionPlugin := apiserverbuilder.NewAdmissionFromBuilders([]apiserverbuilder.APIGroupBuilder{b})

				dash := &dashv1.Dashboard{
					TypeMeta: metav1.TypeMeta{
						APIVersion: dashv1.DashboardResourceInfo.GroupVersion().String(),
						Kind:       dashv1.DashboardResourceInfo.GroupVersionKind().Kind,
					},
					ObjectMeta: metav1.ObjectMeta{Name: "dash-a", Namespace: "stacks-1"},
					Spec: common.Unstructured{Object: map[string]any{
						"title":   "dash",
						"refresh": tt.refresh,
					}},
				}
				var oldObject runtime.Object
				if operation == admission.Update {
					oldObject = dash.DeepCopy()
				}

				err := admissionPlugin.Validate(
					identity.WithRequester(context.Background(), requester),
					admission.NewAttributesRecord(
						dash,
						oldObject,
						dashv1.DashboardResourceInfo.GroupVersionKind(),
						"stacks-1",
						dash.Name,
						dashv1.DashboardResourceInfo.GroupVersionResource(),
						"",
						operation,
						nil,
						false,
						requester,
					), nil)

				if tt.expectedTooLow {
					require.True(t, apierrors.IsBadRequest(err), "got %v", err)
					require.ErrorContains(t, err, "Dashboard refresh interval is too low")
				} else {
					require.NoError(t, err)
				}

				if service != nil {
					require.Equal(t, tt.expectedLookups, service.calls)
					if tt.expectedLookups > 0 {
						require.Equal(t, "stacks-1", service.namespace)
					}
				}
			})
		}
	}
}
