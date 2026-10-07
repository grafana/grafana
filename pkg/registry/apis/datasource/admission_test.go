package datasource

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	jsonpatch "gopkg.in/evanphx/json-patch.v4"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

func TestDataSourceCreateAdmission(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagDatasourcesTeamHttpHeadersWriteGuard)
	resourceInfo := datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("prometheus.datasource.grafana.app", "prometheus")
	apiBuilder := &DataSourceAPIBuilder{datasourceResourceInfo: resourceInfo}
	admissionPlugin := builder.NewAdmissionFromBuilders([]builder.APIGroupBuilder{apiBuilder})

	tests := []struct {
		name      string
		spec      map[string]any
		wantField string
	}{
		{name: "no jsonData", spec: map[string]any{}},
		{name: "null jsonData", spec: map[string]any{"jsonData": nil}},
		{name: "unrelated jsonData", spec: map[string]any{"jsonData": map[string]any{"httpMethod": "POST"}}},
		{name: "headers", spec: map[string]any{"jsonData": map[string]any{"teamHttpHeaders": map[string]any{"secret": "sensitive-value"}}}, wantField: "spec.jsonData.teamHttpHeaders"},
		{name: "null headers", spec: map[string]any{"jsonData": map[string]any{"teamHttpHeaders": nil}}, wantField: "spec.jsonData.teamHttpHeaders"},
		{name: "empty headers", spec: map[string]any{"jsonData": map[string]any{"teamHttpHeaders": map[string]any{}}}, wantField: "spec.jsonData.teamHttpHeaders"},
		{name: "empty header list", spec: map[string]any{"jsonData": map[string]any{"teamHttpHeaders": []any{}}}, wantField: "spec.jsonData.teamHttpHeaders"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ds := &datasourceV0.DataSource{
				ObjectMeta: metav1.ObjectMeta{Name: "example", Namespace: "default"},
				Spec:       datasourceV0.UnstructuredSpec{Object: tt.spec},
			}
			attrs := admission.NewAttributesRecord(
				ds, nil, resourceInfo.GroupVersionKind(), ds.Namespace, ds.Name,
				resourceInfo.GroupVersionResource(), "", admission.Create, &metav1.CreateOptions{}, false, nil,
			)
			err := admissionPlugin.Validate(context.Background(), attrs, nil)
			if tt.wantField == "" {
				require.NoError(t, err)
				return
			}
			require.True(t, apierrors.IsInvalid(err), "expected an invalid-object response: %v", err)
			var statusErr *apierrors.StatusError
			require.ErrorAs(t, err, &statusErr)
			status := statusErr.ErrStatus
			require.Equal(t, tt.wantField, status.Details.Causes[0].Field)
			require.Contains(t, err.Error(), "TeamLBACRule")
			require.NotContains(t, err.Error(), "sensitive-value")
		})
	}

	ds := &datasourceV0.DataSource{
		ObjectMeta: metav1.ObjectMeta{Name: "example", Namespace: "default"},
		Spec: datasourceV0.UnstructuredSpec{Object: map[string]any{
			"jsonData": map[string]any{"teamHttpHeaders": map[string]any{}},
		}},
	}
	for _, tt := range []struct {
		name        string
		operation   admission.Operation
		resource    string
		subresource string
	}{
		{name: "update is outside create guard", operation: admission.Update, resource: resourceInfo.GetName()},
		{name: "other resource is outside create guard", operation: admission.Create, resource: "querytypes"},
		{name: "connect subresource is outside create guard", operation: admission.Connect, resource: resourceInfo.GetName(), subresource: "query"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			gvr := resourceInfo.GroupVersionResource()
			gvr.Resource = tt.resource
			attrs := admission.NewAttributesRecord(
				ds, nil, resourceInfo.GroupVersionKind(), ds.Namespace, ds.Name,
				gvr, tt.subresource, tt.operation, &metav1.CreateOptions{}, false, nil,
			)
			require.NoError(t, admissionPlugin.Validate(context.Background(), attrs, nil))
		})
	}
}

func TestDataSourceCreateAdmissionFlagDisabled(t *testing.T) {
	featuremgmt.WithDisabledFlags(t, featuremgmt.FlagDatasourcesTeamHttpHeadersWriteGuard)
	resourceInfo := datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("prometheus.datasource.grafana.app", "prometheus")
	apiBuilder := &DataSourceAPIBuilder{datasourceResourceInfo: resourceInfo}
	admissionPlugin := builder.NewAdmissionFromBuilders([]builder.APIGroupBuilder{apiBuilder})
	ds := &datasourceV0.DataSource{
		ObjectMeta: metav1.ObjectMeta{Name: "example", Namespace: "default"},
		Spec: datasourceV0.UnstructuredSpec{Object: map[string]any{
			"jsonData": map[string]any{"teamHttpHeaders": map[string]any{}},
		}},
	}
	attrs := admission.NewAttributesRecord(
		ds, nil, resourceInfo.GroupVersionKind(), ds.Namespace, ds.Name,
		resourceInfo.GroupVersionResource(), "", admission.Create, &metav1.CreateOptions{}, false, nil,
	)
	require.NoError(t, admissionPlugin.Validate(context.Background(), attrs, nil))
}

type countingCreateDatasourceProvider struct {
	PluginDatasourceProvider
	creates int
}

func (p *countingCreateDatasourceProvider) CreateDataSource(_ context.Context, ds *datasourceV0.DataSource) (*datasourceV0.DataSource, error) {
	p.creates++
	return ds, nil
}

func TestLegacyStorageCreateGuardBeforeWrite(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagDatasourcesTeamHttpHeadersWriteGuard)
	resourceInfo := datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("prometheus.datasource.grafana.app", "prometheus")
	provider := &countingCreateDatasourceProvider{}
	store := &legacyStorage{datasources: provider, resourceInfo: &resourceInfo}

	blocked := &datasourceV0.DataSource{
		ObjectMeta: metav1.ObjectMeta{Name: "blocked", Namespace: "default"},
		Spec: datasourceV0.UnstructuredSpec{Object: map[string]any{
			"jsonData": map[string]any{"teamHttpHeaders": []any{}},
		}},
	}
	_, err := store.Create(context.Background(), blocked, nil, &metav1.CreateOptions{})
	require.True(t, apierrors.IsInvalid(err), "expected an invalid-object response: %v", err)
	require.Zero(t, provider.creates)

	allowed := &datasourceV0.DataSource{
		ObjectMeta: metav1.ObjectMeta{Name: "allowed", Namespace: "default"},
		Spec: datasourceV0.UnstructuredSpec{Object: map[string]any{
			"jsonData": map[string]any{"httpMethod": "POST"},
		}},
	}
	_, err = store.Create(context.Background(), allowed, nil, &metav1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, 1, provider.creates)
}

func TestLegacyStorageCreateGuardFlagDisabled(t *testing.T) {
	featuremgmt.WithDisabledFlags(t, featuremgmt.FlagDatasourcesTeamHttpHeadersWriteGuard)
	resourceInfo := datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("prometheus.datasource.grafana.app", "prometheus")
	provider := &countingCreateDatasourceProvider{}
	store := &legacyStorage{datasources: provider, resourceInfo: &resourceInfo}
	ds := &datasourceV0.DataSource{
		ObjectMeta: metav1.ObjectMeta{Name: "example", Namespace: "default"},
		Spec: datasourceV0.UnstructuredSpec{Object: map[string]any{
			"jsonData": map[string]any{"teamHttpHeaders": []any{}},
		}},
	}
	_, err := store.Create(context.Background(), ds, nil, &metav1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, 1, provider.creates)
}

func TestDataSourceUpdateAdmission(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagDatasourcesTeamHttpHeadersWriteGuard)
	resourceInfo := datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("prometheus.datasource.grafana.app", "prometheus")
	apiBuilder := &DataSourceAPIBuilder{datasourceResourceInfo: resourceInfo}
	admissionPlugin := builder.NewAdmissionFromBuilders([]builder.APIGroupBuilder{apiBuilder})
	header := map[string]any{"team-1": "sensitive-value"}
	changed := map[string]any{"team-1": "changed-value"}

	tests := []struct {
		name       string
		verb       string
		oldJSON    map[string]any
		newJSON    map[string]any
		wantError  bool
		wantHeader bool
	}{
		{name: "PUT without stored rules", verb: "update"},
		{name: "PUT echoes stored rules", verb: "update", oldJSON: map[string]any{"teamHttpHeaders": header}, newJSON: map[string]any{"teamHttpHeaders": header}, wantHeader: true},
		{name: "PUT omits stored rules", verb: "update", oldJSON: map[string]any{"teamHttpHeaders": header}, newJSON: map[string]any{"httpMethod": "POST"}, wantHeader: true},
		{name: "PUT adds rules", verb: "update", newJSON: map[string]any{"teamHttpHeaders": header}, wantError: true},
		{name: "PUT changes rules", verb: "update", oldJSON: map[string]any{"teamHttpHeaders": header}, newJSON: map[string]any{"teamHttpHeaders": changed}, wantError: true},
		{name: "PUT sets rules to null", verb: "update", oldJSON: map[string]any{"teamHttpHeaders": header}, newJSON: map[string]any{"teamHttpHeaders": nil}, wantError: true},
		{name: "PATCH removes rules", verb: "patch", oldJSON: map[string]any{"teamHttpHeaders": header}, newJSON: map[string]any{"httpMethod": "POST"}, wantError: true},
		{name: "PATCH changes unrelated field", verb: "patch", oldJSON: map[string]any{"teamHttpHeaders": header}, newJSON: map[string]any{"teamHttpHeaders": header, "httpMethod": "POST"}, wantHeader: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			old := updateGuardDataSource("example", tt.oldJSON)
			ds := updateGuardDataSource("example", tt.newJSON)
			ctx := request.WithRequestInfo(context.Background(), &request.RequestInfo{Verb: tt.verb})
			attrs := admission.NewAttributesRecord(ds, old, resourceInfo.GroupVersionKind(), ds.Namespace, ds.Name,
				resourceInfo.GroupVersionResource(), "", admission.Update, &metav1.UpdateOptions{}, false, nil)
			err := admissionPlugin.Admit(ctx, attrs, nil)
			if tt.wantError {
				require.True(t, apierrors.IsInvalid(err), "expected an invalid-object response: %v", err)
				var statusErr *apierrors.StatusError
				require.ErrorAs(t, err, &statusErr)
				require.Equal(t, "spec.jsonData.teamHttpHeaders", statusErr.ErrStatus.Details.Causes[0].Field)
				require.NotContains(t, err.Error(), "sensitive-value")
				return
			}
			require.NoError(t, err)
			jsonData, _ := ds.Spec.JSONData().(map[string]any)
			_, present := jsonData["teamHttpHeaders"]
			require.Equal(t, tt.wantHeader, present)
			if tt.wantHeader {
				require.Equal(t, header, jsonData["teamHttpHeaders"])
			}
		})
	}
}

func TestDataSourceUpdateAdmissionFlagDisabled(t *testing.T) {
	featuremgmt.WithDisabledFlags(t, featuremgmt.FlagDatasourcesTeamHttpHeadersWriteGuard)
	resourceInfo := datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("prometheus.datasource.grafana.app", "prometheus")
	apiBuilder := &DataSourceAPIBuilder{datasourceResourceInfo: resourceInfo}
	admissionPlugin := builder.NewAdmissionFromBuilders([]builder.APIGroupBuilder{apiBuilder})
	old := updateGuardDataSource("example", nil)
	ds := updateGuardDataSource("example", map[string]any{"teamHttpHeaders": []any{}})
	attrs := admission.NewAttributesRecord(ds, old, resourceInfo.GroupVersionKind(), ds.Namespace, ds.Name,
		resourceInfo.GroupVersionResource(), "", admission.Update, &metav1.UpdateOptions{}, false, nil)
	require.NoError(t, admissionPlugin.Admit(context.Background(), attrs, nil))
}

func TestLegacyStorageUpdateGuardBeforeWrite(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagDatasourcesTeamHttpHeadersWriteGuard)
	resourceInfo := datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("prometheus.datasource.grafana.app", "prometheus")
	apiBuilder := &DataSourceAPIBuilder{datasourceResourceInfo: resourceInfo}
	admissionPlugin := builder.NewAdmissionFromBuilders([]builder.APIGroupBuilder{apiBuilder})
	header := map[string]any{"team-1": "sensitive-value"}
	provider := &countingUpdateDatasourceProvider{stored: updateGuardDataSource("example", map[string]any{"teamHttpHeaders": header})}
	store := &legacyStorage{datasources: provider, resourceInfo: &resourceInfo}
	ctx := request.WithRequestInfo(context.Background(), &request.RequestInfo{Verb: "patch"})
	removed := updateGuardDataSource("example", map[string]any{"httpMethod": "POST"})
	_, _, err := store.Update(ctx, "example", admittedUpdateInfo(removed, resourceInfo, admissionPlugin), nil, nil, false, &metav1.UpdateOptions{})
	require.True(t, apierrors.IsInvalid(err), "expected an invalid-object response: %v", err)
	require.Zero(t, provider.updates)

	ctx = request.WithRequestInfo(context.Background(), &request.RequestInfo{Verb: "update"})
	_, _, err = store.Update(ctx, "example", admittedUpdateInfo(removed, resourceInfo, admissionPlugin), nil, nil, false, &metav1.UpdateOptions{})
	require.NoError(t, err)
	require.Equal(t, 1, provider.updates)
	jsonData, _ := provider.lastUpdated.Spec.JSONData().(map[string]any)
	require.Equal(t, header, jsonData["teamHttpHeaders"])
}

func TestLegacyStorageUpdateGuardPatchFormats(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagDatasourcesTeamHttpHeadersWriteGuard)
	resourceInfo := datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("prometheus.datasource.grafana.app", "prometheus")
	apiBuilder := &DataSourceAPIBuilder{datasourceResourceInfo: resourceInfo}
	admissionPlugin := builder.NewAdmissionFromBuilders([]builder.APIGroupBuilder{apiBuilder})
	header := map[string]any{"team-1": "sensitive-value"}
	old := updateGuardDataSource("example", map[string]any{"teamHttpHeaders": header, "httpMethod": "GET"})
	base, err := json.Marshal(old)
	require.NoError(t, err)

	for _, tt := range []struct {
		name      string
		patch     string
		jsonPatch bool
		blocked   bool
	}{
		{name: "JSON Patch removal", patch: `[{"op":"remove","path":"/spec/jsonData/teamHttpHeaders"}]`, jsonPatch: true, blocked: true},
		{name: "merge Patch removal", patch: `{"spec":{"jsonData":{"teamHttpHeaders":null}}}`, blocked: true},
		{name: "JSON Patch unrelated edit", patch: `[{"op":"replace","path":"/spec/jsonData/httpMethod","value":"POST"}]`, jsonPatch: true},
		{name: "merge Patch unrelated edit", patch: `{"spec":{"jsonData":{"httpMethod":"POST"}}}`},
	} {
		t.Run(tt.name, func(t *testing.T) {
			var patched []byte
			var err error
			if tt.jsonPatch {
				patch, decodeErr := jsonpatch.DecodePatch([]byte(tt.patch))
				require.NoError(t, decodeErr)
				patched, err = patch.Apply(base)
			} else {
				patched, err = jsonpatch.MergePatch(base, []byte(tt.patch))
			}
			require.NoError(t, err)
			var requested datasourceV0.DataSource
			require.NoError(t, json.Unmarshal(patched, &requested))
			provider := &countingUpdateDatasourceProvider{stored: old.DeepCopy()}
			store := &legacyStorage{datasources: provider, resourceInfo: &resourceInfo}
			ctx := request.WithRequestInfo(context.Background(), &request.RequestInfo{Verb: "patch"})
			_, _, err = store.Update(ctx, "example", admittedUpdateInfo(&requested, resourceInfo, admissionPlugin), nil, nil, false, &metav1.UpdateOptions{})
			if tt.blocked {
				require.True(t, apierrors.IsInvalid(err), "expected an invalid-object response: %v", err)
				require.Zero(t, provider.updates)
				return
			}
			require.NoError(t, err)
			require.Equal(t, 1, provider.updates)
		})
	}
}

func TestDataSourceUpdateGuardAllowsStaleUnifiedMirror(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagDatasourcesTeamHttpHeadersWriteGuard)
	resourceInfo := datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("prometheus.datasource.grafana.app", "prometheus")
	apiBuilder := &DataSourceAPIBuilder{datasourceResourceInfo: resourceInfo}
	admissionPlugin := builder.NewAdmissionFromBuilders([]builder.APIGroupBuilder{apiBuilder})
	header := map[string]any{"team-1": "sensitive-value"}
	provider := &countingUpdateDatasourceProvider{stored: updateGuardDataSource("example", map[string]any{"teamHttpHeaders": header})}
	legacy := &legacyStorage{datasources: provider, resourceInfo: &resourceInfo}
	mirror := &updateGuardMirrorStorage{
		old:  updateGuardDataSource("example", map[string]any{"httpMethod": "GET"}),
		done: make(chan error, 1),
	}
	cfg := dualwrite.NewFakeConfig()
	cfg.UnifiedStorage[resourceInfo.GroupResource().String()] = setting.UnifiedStorageConfig{DualWriterMode: grafanarest.Mode1}
	store, err := dualwrite.ProvideServiceForTests(cfg).NewStorage(resourceInfo.GroupResource(), legacy, mirror)
	require.NoError(t, err)

	requested := updateGuardDataSource("example", map[string]any{"teamHttpHeaders": header, "httpMethod": "POST"})
	objInfo := admittedUpdateInfo(requested, resourceInfo, admissionPlugin)
	ctx := request.WithRequestInfo(context.Background(), &request.RequestInfo{Verb: "update"})
	_, _, err = store.Update(ctx, "example", objInfo, nil, nil, false, &metav1.UpdateOptions{})
	require.NoError(t, err)
	require.Equal(t, 1, provider.updates)
	select {
	case err := <-mirror.done:
		require.NoError(t, err)
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for mirrored update")
	}
}

func TestDataSourceUpdateGuardUnifiedPrimary(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagDatasourcesTeamHttpHeadersWriteGuard)
	resourceInfo := datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("prometheus.datasource.grafana.app", "prometheus")
	apiBuilder := &DataSourceAPIBuilder{datasourceResourceInfo: resourceInfo}
	admissionPlugin := builder.NewAdmissionFromBuilders([]builder.APIGroupBuilder{apiBuilder})
	header := map[string]any{"team-1": "sensitive-value"}
	provider := &countingUpdateDatasourceProvider{stored: updateGuardDataSource("example", map[string]any{"teamHttpHeaders": header})}
	legacy := &legacyStorage{datasources: provider, resourceInfo: &resourceInfo}
	unified := &updateGuardMirrorStorage{
		old:  updateGuardDataSource("example", map[string]any{"teamHttpHeaders": header}),
		done: make(chan error, 1),
	}
	cfg := dualwrite.NewFakeConfig()
	cfg.UnifiedStorage[resourceInfo.GroupResource().String()] = setting.UnifiedStorageConfig{DualWriterMode: grafanarest.Mode5}
	store, err := dualwrite.ProvideServiceForTests(cfg).NewStorage(resourceInfo.GroupResource(), legacy, unified)
	require.NoError(t, err)

	requested := updateGuardDataSource("example", map[string]any{"httpMethod": "POST"})
	objInfo := admittedUpdateInfo(requested, resourceInfo, admissionPlugin)
	ctx := request.WithRequestInfo(context.Background(), &request.RequestInfo{Verb: "update"})
	obj, _, err := store.Update(ctx, "example", objInfo, nil, nil, false, &metav1.UpdateOptions{})
	require.NoError(t, err)
	require.Zero(t, provider.updates)
	jsonData, _ := obj.(*datasourceV0.DataSource).Spec.JSONData().(map[string]any)
	require.Equal(t, header, jsonData["teamHttpHeaders"])
}

type updateGuardMirrorStorage struct {
	grafanarest.Storage
	old  *datasourceV0.DataSource
	done chan error
}

func (s *updateGuardMirrorStorage) Update(ctx context.Context, _ string, info rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc,
	_ rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	obj, err := info.UpdatedObject(ctx, s.old.DeepCopy())
	s.done <- err
	return obj, false, err
}

func updateGuardDataSource(name string, jsonData map[string]any) *datasourceV0.DataSource {
	return &datasourceV0.DataSource{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default"},
		Spec:       datasourceV0.UnstructuredSpec{Object: map[string]any{"jsonData": jsonData}},
	}
}

func admittedUpdateInfo(requested *datasourceV0.DataSource, resourceInfo utils.ResourceInfo, plugin admission.MutationInterface) rest.UpdatedObjectInfo {
	return rest.DefaultUpdatedObjectInfo(requested, func(ctx context.Context, obj, old runtime.Object) (runtime.Object, error) {
		ds := obj.(*datasourceV0.DataSource)
		attrs := admission.NewAttributesRecord(ds, old, resourceInfo.GroupVersionKind(), ds.Namespace, ds.Name,
			resourceInfo.GroupVersionResource(), "", admission.Update, &metav1.UpdateOptions{}, false, nil)
		return ds, plugin.Admit(ctx, attrs, nil)
	})
}

type countingUpdateDatasourceProvider struct {
	PluginDatasourceProvider
	stored      *datasourceV0.DataSource
	lastUpdated *datasourceV0.DataSource
	updates     int
}

func (p *countingUpdateDatasourceProvider) GetDataSource(_ context.Context, _ string) (*datasourceV0.DataSource, error) {
	return p.stored.DeepCopy(), nil
}

func (p *countingUpdateDatasourceProvider) UpdateDataSource(_ context.Context, ds *datasourceV0.DataSource) (*datasourceV0.DataSource, error) {
	p.updates++
	p.lastUpdated = ds.DeepCopy()
	p.stored = ds.DeepCopy()
	return ds, nil
}
