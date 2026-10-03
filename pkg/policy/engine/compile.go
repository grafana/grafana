package engine

import (
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/google/cel-go/cel"
	celast "github.com/google/cel-go/common/ast"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/policy/api"
	policyschema "github.com/grafana/grafana/pkg/policy/schema"
)

// CompiledPolicy is a policy type-checked against the schema of every kind and version it matches.
// It is immutable and safe for concurrent use.
type CompiledPolicy struct {
	policy   api.Policy
	variants map[schema.GroupVersionKind]*variant
	// paramGVK is empty when the policy has no ParamKind.
	paramGVK schema.GroupVersionKind
}

// Policy returns the source policy.
func (c *CompiledPolicy) Policy() api.Policy { return c.policy }

// ParamGVK returns the kind of the policy's parameter object, and false when it has none.
func (c *CompiledPolicy) ParamGVK() (schema.GroupVersionKind, bool) {
	return c.paramGVK, c.policy.ParamKind != nil
}

func paramGVK(k *api.ParamKind) schema.GroupVersionKind {
	return schema.GroupVersionKind{Group: k.Group, Version: k.Version, Kind: k.Kind}
}

// GVKs returns the kinds and versions the policy applies to, sorted.
func (c *CompiledPolicy) GVKs() []schema.GroupVersionKind {
	gvks := make([]schema.GroupVersionKind, 0, len(c.variants))
	for gvk := range c.variants {
		gvks = append(gvks, gvk)
	}
	slices.SortFunc(gvks, func(a, b schema.GroupVersionKind) int { return strings.Compare(a.String(), b.String()) })
	return gvks
}

// variant is the policy compiled for one kind and version.
type variant struct {
	schema          *spec.Schema
	paramSchema     *spec.Schema
	operations      []api.Operation
	variables       []compiledExpr
	matchConditions []compiledExpr
	validations     []compiledValidation
}

type compiledExpr struct {
	name    string
	path    string
	program cel.Program
	// needsRequest is true when the expression reads oldObject or request, directly or through
	// a variable. Such expressions cannot run on inputs without request context.
	needsRequest bool
}

type compiledValidation struct {
	compiledExpr
	source  api.Validation
	message *compiledExpr
}

// CompileError reports every expression that failed to compile, for every kind and version.
type CompileError struct {
	Policy string
	Errors []ExpressionError
}

// ExpressionError is a compilation failure of one expression against one kind and version.
type ExpressionError struct {
	GVK  schema.GroupVersionKind
	Path string
	Err  error
}

func (e *CompileError) Error() string {
	msgs := make([]string, 0, len(e.Errors))
	for _, err := range e.Errors {
		if err.GVK.Empty() {
			msgs = append(msgs, fmt.Sprintf("%s: %v", err.Path, err.Err))
			continue
		}
		msgs = append(msgs, fmt.Sprintf("%s [%s]: %v", err.Path, err.GVK, err.Err))
	}
	return fmt.Sprintf("policy %q failed to compile:\n  %s", e.Policy, strings.Join(msgs, "\n  "))
}

// Compiler compiles policies against schemas from a resolver.
type Compiler struct {
	resolver policyschema.Resolver
}

func NewCompiler(resolver policyschema.Resolver) *Compiler {
	return &Compiler{resolver: resolver}
}

// Compile validates the policy and type-checks every expression against each kind and version
// the policy matches. It fails if any expression fails for any of them, so a policy never
// silently behaves differently across the kinds it targets.
func (c *Compiler) Compile(p api.Policy) (*CompiledPolicy, error) {
	cerr := &CompileError{Policy: p.Name}
	for _, e := range p.Validate() {
		cerr.Errors = append(cerr.Errors, ExpressionError{Path: e.Field, Err: errors.New(e.ErrorBody())})
	}
	if len(cerr.Errors) > 0 {
		return nil, cerr
	}

	compiled := &CompiledPolicy{policy: p, variants: map[schema.GroupVersionKind]*variant{}}
	var paramSchema *spec.Schema
	if p.ParamKind != nil {
		compiled.paramGVK = paramGVK(p.ParamKind)
		s, err := c.resolver.ResolveSchema(compiled.paramGVK)
		if err != nil {
			cerr.Errors = append(cerr.Errors, ExpressionError{GVK: compiled.paramGVK, Path: "paramKind", Err: fmt.Errorf("resolving schema: %w", err)})
			return nil, cerr
		}
		paramSchema = s
	}
	for gvk, ops := range matchedGVKs(p.Match) {
		v, errs := c.compileVariant(p, gvk, ops, compiled.paramGVK, paramSchema)
		cerr.Errors = append(cerr.Errors, errs...)
		if v != nil {
			compiled.variants[gvk] = v
		}
	}
	if len(cerr.Errors) > 0 {
		slices.SortStableFunc(cerr.Errors, func(a, b ExpressionError) int {
			return strings.Compare(a.GVK.String()+a.Path, b.GVK.String()+b.Path)
		})
		return nil, cerr
	}
	return compiled, nil
}

// matchedGVKs expands resource matches into kinds and versions, merging operations when
// several matches select the same kind and version.
func matchedGVKs(matches []api.ResourceMatch) map[schema.GroupVersionKind][]api.Operation {
	out := map[schema.GroupVersionKind][]api.Operation{}
	for _, m := range matches {
		for _, v := range m.Versions {
			for _, k := range m.Kinds {
				gvk := schema.GroupVersionKind{Group: m.Group, Version: v, Kind: k}
				for _, op := range m.EffectiveOperations() {
					if !slices.Contains(out[gvk], op) {
						out[gvk] = append(out[gvk], op)
					}
				}
			}
		}
	}
	return out
}

func (c *Compiler) compileVariant(p api.Policy, gvk schema.GroupVersionKind, ops []api.Operation, paramGVK schema.GroupVersionKind, paramSchema *spec.Schema) (*variant, []ExpressionError) {
	s, err := c.resolver.ResolveSchema(gvk)
	if err != nil {
		return nil, []ExpressionError{{GVK: gvk, Path: "match", Err: fmt.Errorf("resolving schema: %w", err)}}
	}
	te, err := newTypedEnv(gvk, s, paramGVK, paramSchema)
	if err != nil {
		return nil, []ExpressionError{{GVK: gvk, Path: "match", Err: err}}
	}

	var errs []ExpressionError
	fail := func(path string, err error) {
		errs = append(errs, ExpressionError{GVK: gvk, Path: path, Err: err})
	}
	v := &variant{schema: te.schema, paramSchema: te.paramSchema, operations: ops}
	// Variables that need request context, so that expressions using them inherit the requirement.
	requestVariables := map[string]bool{}

	for i, nv := range p.Variables {
		path := fmt.Sprintf("variables[%d].expression", i)
		ce, outType, err := compile(te, nv.Expression, nil, requestVariables)
		if err != nil {
			fail(path, err)
			// Still declare the variable so later expressions report their own errors rather
			// than a misleading "undefined field".
			te.addVariable(nv.Name, cel.DynType)
			continue
		}
		ce.name, ce.path = nv.Name, path
		te.addVariable(nv.Name, outType)
		requestVariables[nv.Name] = ce.needsRequest
		v.variables = append(v.variables, ce)
	}

	for i, mc := range p.MatchConditions {
		path := fmt.Sprintf("matchConditions[%d].expression", i)
		ce, _, err := compile(te, mc.Expression, cel.BoolType, requestVariables)
		if err != nil {
			fail(path, err)
			continue
		}
		ce.name, ce.path = mc.Name, path
		v.matchConditions = append(v.matchConditions, ce)
	}

	for i, val := range p.Validations {
		path := fmt.Sprintf("validations[%d].expression", i)
		ce, _, err := compile(te, val.Expression, cel.BoolType, requestVariables)
		if err != nil {
			fail(path, err)
			continue
		}
		ce.name, ce.path = validationName(val, i), path
		cv := compiledValidation{compiledExpr: ce, source: val}
		if val.MessageExpression != "" {
			msgPath := fmt.Sprintf("validations[%d].messageExpression", i)
			me, _, err := compile(te, val.MessageExpression, cel.StringType, requestVariables)
			if err != nil {
				fail(msgPath, err)
				continue
			}
			me.path = msgPath
			cv.message = &me
		}
		v.validations = append(v.validations, cv)
	}

	if len(errs) > 0 {
		return nil, errs
	}
	return v, nil
}

func validationName(v api.Validation, i int) string {
	if v.Name != "" {
		return v.Name
	}
	return fmt.Sprintf("validations[%d]", i)
}

// compile type-checks an expression. When want is set the expression must produce that type;
// dyn is accepted because loosely typed schemas (such as fields that preserve unknown fields)
// can only be checked at evaluation time.
func compile(te *typedEnv, expr string, want *cel.Type, requestVariables map[string]bool) (compiledExpr, *cel.Type, error) {
	ast, iss := te.env.Compile(expr)
	if iss.Err() != nil {
		return compiledExpr{}, nil, iss.Err()
	}
	out := ast.OutputType()
	if want != nil && !out.IsExactType(want) && !out.IsExactType(cel.DynType) {
		return compiledExpr{}, nil, fmt.Errorf("must evaluate to %s, got %s", want, out)
	}
	prg, err := te.env.Program(ast)
	if err != nil {
		return compiledExpr{}, nil, err
	}
	return compiledExpr{program: prg, needsRequest: needsRequest(ast, requestVariables)}, out, nil
}

// needsRequest reports whether the expression reads request-only data: oldObject, request, or a
// variable that does. Uses of `variables` other than field selection are treated as using every
// variable.
func needsRequest(ast *cel.Ast, requestVariables map[string]bool) bool {
	nav := celast.NavigateAST(ast.NativeRep())
	for _, e := range celast.MatchDescendants(nav, celast.AllMatcher()) {
		switch e.Kind() {
		case celast.IdentKind:
			switch e.AsIdent() {
			case oldObjectVarName, requestVarName:
				return true
			case variablesVarName:
				if parent, ok := e.Parent(); !ok || parent.Kind() != celast.SelectKind {
					for _, needs := range requestVariables {
						if needs {
							return true
						}
					}
				}
			}
		case celast.SelectKind:
			sel := e.AsSelect()
			if op := sel.Operand(); op.Kind() == celast.IdentKind && op.AsIdent() == variablesVarName && requestVariables[sel.FieldName()] {
				return true
			}
		}
	}
	return false
}
