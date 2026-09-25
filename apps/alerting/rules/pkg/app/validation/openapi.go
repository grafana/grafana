package validation

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

type SpecValidator struct {
	gk     schema.GroupKind
	schema *openapi3.Schema
}

func NewSpecValidator(gk schema.GroupKind, vs *app.VersionSchema, kindObjectName string) (*SpecValidator, error) {
	if vs == nil {
		return nil, fmt.Errorf("VersionSchema is nil")
	}
	crd, err := vs.AsCRDOpenAPI3(kindObjectName)
	if err != nil {
		return nil, fmt.Errorf("error resolving schema for kind %q: %w", kindObjectName, err)
	}
	specRef, ok := crd.Properties["spec"]
	if !ok || specRef == nil || specRef.Value == nil {
		return nil, fmt.Errorf("kind %q schema has no spec property", kindObjectName)
	}
	return &SpecValidator{gk: gk, schema: specRef.Value}, nil
}

func (v *SpecValidator) ValidateOpenAPISpec(name string, spec any) error {
	b, err := json.Marshal(spec)
	if err != nil {
		return fmt.Errorf("error marshaling spec: %w", err)
	}
	dec := json.NewDecoder(bytes.NewReader(b))
	var decoded any
	if err := dec.Decode(&decoded); err != nil {
		return fmt.Errorf("error decoding spec: %w", err)
	}

	if err := v.schema.VisitJSON(decoded, openapi3.MultiErrors()); err != nil {
		return v.toAPIError(name, err)
	}
	return nil
}

func (v *SpecValidator) toAPIError(name string, verr error) *apierrors.StatusError {
	var errs field.ErrorList

	if me, ok := errors.AsType[openapi3.MultiError](verr); ok {
		for _, e := range me {
			errs = append(errs, toFieldError(e))
		}
	} else {
		errs = append(errs, toFieldError(verr))
	}

	return apierrors.NewInvalid(v.gk, name, errs)
}

func toFieldError(e error) *field.Error {
	if se, ok := errors.AsType[*openapi3.SchemaError](e); ok {
		return schemaErrorToField(se)
	}
	return field.Invalid(field.NewPath("spec"), nil, e.Error())
}

func schemaErrorToField(se *openapi3.SchemaError) *field.Error {
	path := field.NewPath("spec")
	for _, seg := range se.JSONPointer() {
		path = path.Child(seg)
	}
	reason := se.Reason
	if reason == "" {
		reason = fmt.Sprintf("does not satisfy %q constraint", se.SchemaField)
	}

	return field.Invalid(path, se.Value, reason)
}

func OpenAPISpec[T resource.Object](md app.ManifestData, gk schema.GroupKind) (ValidateFunc[T], error) {
	vs := schemaForKind(md, gk.Kind)
	if vs == nil {
		return func(context.Context, Request[T]) error { return nil }, nil
	}
	sv, err := NewSpecValidator(gk, vs, gk.Kind)
	if err != nil {
		return nil, err
	}
	return func(_ context.Context, req Request[T]) error {
		return sv.ValidateOpenAPISpec(req.Object.GetName(), req.Object.GetSpec())
	}, nil
}

func schemaForKind(md app.ManifestData, kind string) *app.VersionSchema {
	for _, version := range md.Versions {
		for _, k := range version.Kinds {
			if k.Kind == kind {
				return k.Schema
			}
		}
	}
	return nil
}
