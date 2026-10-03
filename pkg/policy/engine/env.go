package engine

import (
	"fmt"
	"maps"
	"strings"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/types/traits"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/version"
	apiservercel "k8s.io/apiserver/pkg/cel"
	"k8s.io/apiserver/pkg/cel/environment"
	"k8s.io/apiserver/pkg/cel/openapi"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

// compatibilityVersion pins the CEL libraries and language features available to policies.
// It is fixed rather than derived from the binary's Kubernetes version so that every execution
// environment (server, CLI, webhook) accepts exactly the same expressions.
var compatibilityVersion = version.MajorMinor(1, 36)

const (
	objectVarName    = "object"
	oldObjectVarName = "oldObject"
	requestVarName   = "request"
	namespaceVarName = "namespace"
	variablesVarName = "variables"
	paramsVarName    = "params"

	variablesTypeName = "grafana.policy.Variables"
)

var requestType = apiservercel.NewObjectType("grafana.policy.Request", map[string]*apiservercel.DeclField{
	"operation": apiservercel.NewDeclField("operation", apiservercel.StringType, true, nil, nil),
	"name":      apiservercel.NewDeclField("name", apiservercel.StringType, true, nil, nil),
	"namespace": apiservercel.NewDeclField("namespace", apiservercel.StringType, true, nil, nil),
	"userInfo": apiservercel.NewDeclField("userInfo", apiservercel.NewObjectType("grafana.policy.UserInfo", map[string]*apiservercel.DeclField{
		"username": apiservercel.NewDeclField("username", apiservercel.StringType, true, nil, nil),
		"uid":      apiservercel.NewDeclField("uid", apiservercel.StringType, true, nil, nil),
		"groups":   apiservercel.NewDeclField("groups", apiservercel.NewListType(apiservercel.StringType, -1), true, nil, nil),
	}), true, nil, nil),
})

// typedEnv is the CEL environment for one kind and version of a policy.
type typedEnv struct {
	env *cel.Env
	// schema is the resource schema including apiVersion, kind and metadata. It is used to
	// convert unstructured objects into CEL values.
	schema *spec.Schema
	// variables is the type of the `variables` object. Fields are added as variables compile,
	// which the environment observes because it holds the same pointer.
	variables *apiservercel.DeclType
	// paramSchema is the parameter object's schema, nil when the policy has no ParamKind.
	paramSchema *spec.Schema
}

// newTypedEnv builds the environment for one kind and version. paramGVK and paramSchema are
// set only when the policy declares a ParamKind; otherwise `params` is undeclared.
func newTypedEnv(gvk schema.GroupVersionKind, resourceSchema *spec.Schema, paramGVK schema.GroupVersionKind, paramSchema *spec.Schema) (*typedEnv, error) {
	s := withTypeAndObjectMeta(resourceSchema)
	objectType := openapi.SchemaDeclType(s, true)
	if objectType == nil {
		return nil, fmt.Errorf("schema for %s cannot be represented as a CEL type", gvk)
	}
	objectType = objectType.MaybeAssignTypeName(typeName(gvk))
	variables := apiservercel.NewObjectType(variablesTypeName, map[string]*apiservercel.DeclField{})

	envOpts := []cel.EnvOption{
		cel.Variable(objectVarName, objectType.CelType()),
		cel.Variable(oldObjectVarName, objectType.CelType()),
		cel.Variable(requestVarName, requestType.CelType()),
		cel.Variable(namespaceVarName, cel.StringType),
		cel.Variable(variablesVarName, variables.CelType()),
	}
	declTypes := []*apiservercel.DeclType{objectType, requestType, variables}

	var ps *spec.Schema
	if paramSchema != nil {
		ps = withTypeAndObjectMeta(paramSchema)
		paramType := openapi.SchemaDeclType(ps, true)
		if paramType == nil {
			return nil, fmt.Errorf("schema for param kind %s cannot be represented as a CEL type", paramGVK)
		}
		// The parameter kind may be the resource kind itself, so its type name must differ.
		paramType = paramType.MaybeAssignTypeName("params." + typeName(paramGVK))
		envOpts = append(envOpts, cel.Variable(paramsVarName, paramType.CelType()))
		declTypes = append(declTypes, paramType)
	}

	envSet, err := environment.MustBaseEnvSet(compatibilityVersion).Extend(environment.VersionedOptions{
		IntroducedVersion: version.MajorMinor(1, 0),
		EnvOptions:        envOpts,
		ProgramOptions: []cel.ProgramOption{
			// Lets long-running comprehensions observe context cancellation.
			cel.InterruptCheckFrequency(100),
		},
		DeclTypes: declTypes,
	})
	if err != nil {
		return nil, fmt.Errorf("building CEL environment for %s: %w", gvk, err)
	}
	env, err := envSet.Env(environment.NewExpressions)
	if err != nil {
		return nil, err
	}
	return &typedEnv{env: env, schema: s, variables: variables, paramSchema: ps}, nil
}

// typeName returns a CEL type name for the kind that is unique within an environment and
// readable in type errors.
func typeName(gvk schema.GroupVersionKind) string {
	return strings.ReplaceAll(gvk.Group, ".", "_") + "." + gvk.Version + "." + gvk.Kind
}

// addVariable makes a compiled variable visible to the expressions compiled after it.
func (t *typedEnv) addVariable(name string, celType *cel.Type) {
	t.variables.Fields[name] = apiservercel.NewDeclField(name, declTypeOf(celType), true, nil, nil)
}

// declTypeOf converts the output type of a compiled expression into a DeclType so that it
// can be used as a field of the `variables` object.
func declTypeOf(t *cel.Type) *apiservercel.DeclType {
	if t == nil {
		return apiservercel.DynType
	}
	switch t {
	case cel.AnyType:
		return apiservercel.AnyType
	case cel.BoolType:
		return apiservercel.BoolType
	case cel.BytesType:
		return apiservercel.BytesType
	case cel.DoubleType:
		return apiservercel.DoubleType
	case cel.DurationType:
		return apiservercel.DurationType
	case cel.IntType:
		return apiservercel.IntType
	case cel.NullType:
		return apiservercel.NullType
	case cel.StringType:
		return apiservercel.StringType
	case cel.TimestampType:
		return apiservercel.TimestampType
	case cel.UintType:
		return apiservercel.UintType
	}
	if t.HasTrait(traits.ContainerType) && t.HasTrait(traits.IndexerType) {
		switch params := t.Parameters(); len(params) {
		case 1:
			return apiservercel.NewListType(declTypeOf(params[0]), -1)
		case 2:
			return apiservercel.NewMapType(declTypeOf(params[0]), declTypeOf(params[1]), -1)
		}
	}
	return apiservercel.DynType
}

// withTypeAndObjectMeta adds apiVersion, kind and metadata to a resource schema.
//
// Kubernetes' common.WithTypeAndObjectMeta only declares metadata.name and generateName, as
// CRD validation rules do. Policies routinely inspect labels, annotations and namespace, so
// the full set of commonly used ObjectMeta fields is declared here.
func withTypeAndObjectMeta(s *spec.Schema) *spec.Schema {
	result := *s
	result.Properties = make(map[string]spec.Schema, len(s.Properties)+3)
	maps.Copy(result.Properties, s.Properties)
	if len(result.Type) == 0 {
		result.Type = []string{"object"}
	}

	str := *spec.StringProperty()
	stringMap := *spec.MapProperty(spec.StringProperty())
	stringList := *spec.ArrayProperty(spec.StringProperty())
	timestamp := *spec.StringProperty()
	timestamp.Format = "date-time"

	result.Properties["apiVersion"] = str
	result.Properties["kind"] = str
	result.Properties["metadata"] = spec.Schema{SchemaProps: spec.SchemaProps{
		Type: []string{"object"},
		Properties: map[string]spec.Schema{
			"name":              str,
			"generateName":      str,
			"namespace":         str,
			"uid":               str,
			"resourceVersion":   str,
			"generation":        *spec.Int64Property(),
			"creationTimestamp": timestamp,
			"deletionTimestamp": timestamp,
			"labels":            stringMap,
			"annotations":       stringMap,
			"finalizers":        stringList,
		},
	}}
	return &result
}
