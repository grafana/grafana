package app

import (
	"context"
	"maps"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/cel/openapi/resolver"
	"k8s.io/kube-openapi/pkg/common"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	foldersv1beta1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	policyv0alpha1 "github.com/grafana/grafana/apps/policy/pkg/apis/policy/v0alpha1"
	policyapp "github.com/grafana/grafana/apps/policy/pkg/app"
	commonv0alpha1 "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/policy/api"
	"github.com/grafana/grafana/pkg/policy/engine"
	policyschema "github.com/grafana/grafana/pkg/policy/schema"
	"github.com/grafana/grafana/pkg/policy/schema/manifest"

	foldernamingv0alpha1 "github.com/grafana/grafana/apps/foldernaming/pkg/apis/foldernaming/v0alpha1"
	"github.com/grafana/grafana/apps/foldernaming/pkg/apis/manifestdata"
)

const namespace = "stack-1"

// folderNamingPolicies is a ParamSource serving FolderNamingPolicies by name, as the API would.
type folderNamingPolicies map[string]*foldernamingv0alpha1.FolderNamingPolicy

func (p folderNamingPolicies) GetParams(_ context.Context, _ schema.GroupVersionKind, _, name string) (map[string]any, error) {
	fp, ok := p[name]
	if !ok {
		return nil, engine.ErrParamsNotFound
	}
	return runtime.DefaultUnstructuredConverter.ToUnstructured(fp)
}

func namingPolicy(name string, enforcement foldernamingv0alpha1.FolderNamingPolicyEnforcement, pattern string, description *string) *foldernamingv0alpha1.FolderNamingPolicy {
	return &foldernamingv0alpha1.FolderNamingPolicy{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace},
		Spec:       foldernamingv0alpha1.FolderNamingPolicySpec{Enforcement: enforcement, TitlePattern: pattern, Description: description},
	}
}

// folderResolver resolves folder schemas the way the API server does: from the folder API's
// OpenAPI definitions, which have no app manifest.
func folderResolver(t *testing.T) policyschema.Resolver {
	t.Helper()
	scheme := runtime.NewScheme()
	scheme.AddKnownTypes(foldersv1.SchemeGroupVersion, &foldersv1.Folder{}, &foldersv1.FolderList{})
	scheme.AddKnownTypes(foldersv1beta1.SchemeGroupVersion, &foldersv1beta1.Folder{}, &foldersv1beta1.FolderList{})
	defs := func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		out := commonv0alpha1.GetOpenAPIDefinitions(ref)
		maps.Copy(out, foldersv1.GetOpenAPIDefinitions(ref))
		maps.Copy(out, foldersv1beta1.GetOpenAPIDefinitions(ref))
		return out
	}
	params, err := manifest.NewResolver(*manifestdata.LocalManifest().ManifestData)
	require.NoError(t, err)
	return policyschema.Combine(params, resolver.NewDefinitionsSchemaResolver(defs, scheme))
}

func managedSet(t *testing.T, policies folderNamingPolicies) *engine.Set {
	t.Helper()
	compiler := engine.NewCompiler(folderResolver(t))
	var compiled []*engine.CompiledPolicy
	var bindings []api.Binding
	for _, fp := range policies {
		meta := metav1.ObjectMeta{Name: managedName(fp.Name), Namespace: namespace}
		cp, err := compiler.Compile(policyapp.ToPolicy(&policyv0alpha1.ValidationPolicy{ObjectMeta: meta, Spec: policySpec()}))
		require.NoError(t, err)
		compiled = append(compiled, cp)
		bindings = append(bindings, policyapp.ToBinding(&policyv0alpha1.ValidationPolicyBinding{ObjectMeta: meta, Spec: bindingSpec(fp)}))
	}
	set, err := engine.NewSet(compiled, bindings, policies)
	require.NoError(t, err)
	return set
}

func folder(title string) map[string]any {
	return map[string]any{"metadata": map[string]any{"name": "f1", "namespace": namespace}, "spec": map[string]any{"title": title}}
}

// write returns the messages of every decision, keyed by "<binding>/<action>". old is nil for a create.
func write(t *testing.T, set *engine.Set, version string, obj, old map[string]any) map[string][]string {
	t.Helper()
	in := engine.Input{
		GVK:       schema.GroupVersionKind{Group: folderGroup, Version: version, Kind: "Folder"},
		Namespace: namespace,
		Object:    obj,
		OldObject: old,
		Request:   &engine.RequestInfo{Operation: api.OperationCreate},
	}
	if old != nil {
		in.Request.Operation = api.OperationUpdate
	}
	ev := set.EvaluateAll(context.Background(), in)
	for _, r := range ev.Results {
		require.Empty(t, r.Errors)
	}
	out := map[string][]string{}
	for _, d := range ev.Decisions {
		key := d.Binding + "/" + string(d.Action)
		out[key] = append(out[key], d.Message)
	}
	return out
}

func TestFolderNamingPolicy(t *testing.T) {
	description := "start with the owning team, like 'team-a: Alerts'"
	set := managedSet(t, folderNamingPolicies{
		"team-prefix": namingPolicy("team-prefix", foldernamingv0alpha1.FolderNamingPolicyEnforcementDeny, `[a-z0-9-]+: .+`, &description),
		"short":       namingPolicy("short", foldernamingv0alpha1.FolderNamingPolicyEnforcementWarn, `.{1,40}`, nil),
	})

	for _, version := range folderVersions {
		t.Run(version, func(t *testing.T) {
			t.Run("titles following every convention pass", func(t *testing.T) {
				require.Empty(t, write(t, set, version, folder("team-a: Alerts"), nil))
			})

			t.Run("each policy applies with its own enforcement", func(t *testing.T) {
				got := write(t, set, version, folder("Alerts for the platform team that keep getting longer"), nil)
				require.Equal(t, map[string][]string{
					"foldernaming-team-prefix/Deny": {`folder title "Alerts for the platform team that keep getting longer" does not follow the naming convention: start with the owning team, like 'team-a: Alerts'`},
					"foldernaming-short/Warn":       {`folder title "Alerts for the platform team that keep getting longer" does not follow the naming convention .{1,40}`},
				}, got)
			})

			t.Run("the whole title must match", func(t *testing.T) {
				got := write(t, set, version, folder("Shared: team-a: Alerts"), nil)
				require.Len(t, got["foldernaming-team-prefix/Deny"], 1)
			})

			t.Run("existing folders keep their titles on update", func(t *testing.T) {
				require.Empty(t, write(t, set, version, folder("Legacy"), folder("Legacy")))
			})

			t.Run("renaming must follow the convention", func(t *testing.T) {
				got := write(t, set, version, folder("Still legacy"), folder("Legacy"))
				require.Len(t, got["foldernaming-team-prefix/Deny"], 1)
				require.Empty(t, write(t, set, version, folder("team-a: Legacy"), folder("Legacy")))
			})
		})
	}
}

func TestValidate(t *testing.T) {
	tests := []struct {
		name string
		fp   *foldernamingv0alpha1.FolderNamingPolicy
		want []string
	}{
		{name: "valid", fp: namingPolicy("p", foldernamingv0alpha1.FolderNamingPolicyEnforcementWarn, `[a-z]+`, nil)},
		{name: "enforcement is required", fp: namingPolicy("p", "", `[a-z]+`, nil), want: []string{"spec.enforcement"}},
		{name: "pattern is required", fp: namingPolicy("p", foldernamingv0alpha1.FolderNamingPolicyEnforcementDeny, "", nil), want: []string{"spec.titlePattern"}},
		{name: "pattern must be RE2", fp: namingPolicy("p", foldernamingv0alpha1.FolderNamingPolicyEnforcementDeny, `(?<=a)b`, nil), want: []string{"spec.titlePattern"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validate(tt.fp)
			if len(tt.want) == 0 {
				require.NoError(t, err)
				return
			}
			var status apierrors.APIStatus
			require.ErrorAs(t, err, &status)
			var fields []string
			for _, c := range status.Status().Details.Causes {
				fields = append(fields, c.Field)
			}
			require.ElementsMatch(t, tt.want, fields)
		})
	}
}
