package search

import (
	"context"
	"errors"
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	appresource "github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

type routeHandler func(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error

type fakeBackend struct {
	queries []*Query
	result  *Result
	err     error
}

func (b *fakeBackend) Search(_ context.Context, query *Query) (*Result, error) {
	b.queries = append(b.queries, query)
	if b.result != nil {
		return b.result, b.err
	}
	return &Result{Hits: []Hit{}}, b.err
}

func TestBackendModeChanges(t *testing.T) {
	alertGR := alertrule.ResourceInfo.GroupResource()
	recordingGR := recordingrule.ResourceInfo.GroupResource()
	cfg := &setting.Cfg{UnifiedStorage: map[string]setting.UnifiedStorageConfig{}}
	legacy, unified := &fakeBackend{}, &fakeBackend{}
	dual := dualwrite.ProvideServiceForTests(cfg)
	h := NewHandler(dualwrite.NewSelector[Backend](dual, alertGR, legacy, unified), dualwrite.NewSelector[Backend](dual, recordingGR, legacy, unified))

	for _, mode := range []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5, rest.Mode0} {
		recordingMode := rest.Mode5
		if mode >= rest.Mode4 {
			recordingMode = rest.Mode0
		}
		cfg.UnifiedStorage[alertGR.String()] = setting.UnifiedStorageConfig{DualWriterMode: mode}
		cfg.UnifiedStorage[recordingGR.String()] = setting.UnifiedStorageConfig{DualWriterMode: recordingMode}
		for _, tc := range []struct {
			name      string
			route     routeHandler
			body      string
			primary   schema.GroupResource
			federated []schema.GroupResource
			perKind   bool
			unified   bool
		}{
			{name: "alert route", route: h.SearchAlertRules, body: validBody, primary: alertGR, perKind: true, unified: mode >= rest.Mode4},
			{name: "recording route", route: h.SearchRecordingRules, body: validBody, primary: recordingGR, perKind: true, unified: recordingMode >= rest.Mode4},
			{name: "combined route", route: h.SearchRules, body: `{}`, primary: alertGR, federated: []schema.GroupResource{recordingGR}, unified: mode >= rest.Mode4},
			{name: "combined recording filter", route: h.SearchRules, body: `{"where":{"filter":{"field":"type","operator":"In","values":["recordingrule"]}}}`, primary: recordingGR, unified: recordingMode >= rest.Mode4},
		} {
			t.Run(fmt.Sprint(mode)+"/"+tc.name, func(t *testing.T) {
				legacy.queries, unified.queries = nil, nil
				w := httptest.NewRecorder()
				require.NoError(t, tc.route(t.Context(), w, &app.CustomRouteRequest{
					ResourceIdentifier: appresource.FullIdentifier{Namespace: "stacks-1"}, Body: readCloser(tc.body),
				}))
				require.Equal(t, 200, w.Code)
				selected, unused := legacy, unified
				if tc.unified {
					selected, unused = unified, legacy
				}
				require.Empty(t, unused.queries)
				require.Len(t, selected.queries, 1)
				query := selected.queries[0]
				require.Equal(t, "stacks-1", query.Namespace)
				require.Equal(t, tc.primary, query.Primary)
				require.Equal(t, tc.federated, query.Federated)
				require.Equal(t, tc.perKind, query.PerKind)
			})
		}
	}
}

type modeReaderFunc func(context.Context, schema.GroupResource) (bool, error)

func (f modeReaderFunc) ReadFromUnified(ctx context.Context, gr schema.GroupResource) (bool, error) {
	return f(ctx, gr)
}

func TestBackendErrorsDoNotFallback(t *testing.T) {
	for _, mode := range []bool{false, true} {
		for _, selectionError := range []bool{false, true} {
			wantErr := errors.New("unavailable")
			legacy, unified := &fakeBackend{err: wantErr}, &fakeBackend{err: wantErr}
			reader := modeReaderFunc(func(context.Context, schema.GroupResource) (bool, error) {
				if selectionError {
					return false, wantErr
				}
				return mode, nil
			})
			h := NewHandler(dualwrite.NewSelector[Backend](reader, alertrule.ResourceInfo.GroupResource(), legacy, unified),
				dualwrite.NewSelector[Backend](reader, recordingrule.ResourceInfo.GroupResource(), legacy, unified))
			for _, tc := range []struct {
				route routeHandler
				body  string
			}{
				{h.SearchRules, `{}`}, {h.SearchAlertRules, validBody}, {h.SearchRecordingRules, validBody},
			} {
				legacy.queries, unified.queries = nil, nil
				err := tc.route(t.Context(), httptest.NewRecorder(), &app.CustomRouteRequest{
					ResourceIdentifier: appresource.FullIdentifier{Namespace: "stacks-1"}, Body: readCloser(tc.body),
				})
				require.ErrorIs(t, err, wantErr)
				require.Equal(t, !selectionError && !mode, len(legacy.queries) == 1)
				require.Equal(t, !selectionError && mode, len(unified.queries) == 1)
			}
		}
	}
}
