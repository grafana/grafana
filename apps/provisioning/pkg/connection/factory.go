package connection

import (
	"context"
	"fmt"
	"sort"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

//go:generate mockery --name=Extra --structname=MockExtra --inpackage --filename=extra_mock.go --with-expecter
type Extra interface {
	Type() provisioning.ConnectionType
	Build(ctx context.Context, r *provisioning.Connection) (Connection, error)
	Mutate(ctx context.Context, obj runtime.Object) error
	Validate(ctx context.Context, obj runtime.Object) field.ErrorList
}

//go:generate mockery --name=Factory --structname=MockFactory --inpackage --filename=factory_mock.go --with-expecter
type Factory interface {
	Types() []provisioning.ConnectionType
	Build(ctx context.Context, r *provisioning.Connection) (Connection, error)
	Mutate(ctx context.Context, obj runtime.Object) error
	Validate(ctx context.Context, obj runtime.Object) field.ErrorList
}

type factory struct {
	extras  map[provisioning.ConnectionType]Extra
	enabled map[provisioning.ConnectionType]struct{}
	tracer  trace.Tracer
}

func ToConnectionTypes(connectionTypes []string) map[provisioning.ConnectionType]struct{} {
	enabled := make(map[provisioning.ConnectionType]struct{}, len(connectionTypes))
	for _, t := range connectionTypes {
		enabled[provisioning.ConnectionType(t)] = struct{}{}
	}
	return enabled
}

func ProvideFactory(enabled map[provisioning.ConnectionType]struct{}, extras []Extra, tracer trace.Tracer) (Factory, error) {
	f := &factory{
		enabled: enabled,
		extras:  make(map[provisioning.ConnectionType]Extra, len(extras)),
		tracer:  tracer,
	}

	for _, e := range extras {
		if _, exists := f.extras[e.Type()]; exists {
			return nil, fmt.Errorf("connection type %q is already registered", e.Type())
		}
		f.extras[e.Type()] = e
	}

	return f, nil
}

func (f *factory) Types() []provisioning.ConnectionType {
	var types []provisioning.ConnectionType
	for t := range f.enabled {
		if _, exists := f.extras[t]; exists {
			types = append(types, t)
		}
	}

	sort.Slice(types, func(i, j int) bool {
		return string(types[i]) < string(types[j])
	})

	return types
}

func (f *factory) Build(ctx context.Context, c *provisioning.Connection) (Connection, error) {
	// Build is the single chokepoint every caller funnels through to construct a
	// connection, and where the connection's token is decrypted via the secrets
	// service. Tracing it here gives that decrypt call a descriptive parent
	// regardless of the caller.
	ctx, span := f.tracer.Start(ctx, "provisioning.connection.build",
		trace.WithAttributes(
			attribute.String("connection.name", c.GetName()),
			attribute.String("connection.namespace", c.GetNamespace()),
			attribute.String("connection.type", string(c.Spec.Type)),
		),
	)
	defer span.End()

	for _, e := range f.extras {
		if e.Type() == c.Spec.Type {
			if _, enabled := f.enabled[e.Type()]; !enabled {
				err := fmt.Errorf("connection type %q is not enabled", e.Type())
				span.RecordError(err)
				return nil, err
			}

			conn, err := e.Build(ctx, c)
			if err != nil {
				span.RecordError(err)
			}
			return conn, err
		}
	}

	err := fmt.Errorf("connection type %q is not supported", c.Spec.Type)
	span.RecordError(err)
	return nil, err
}

func (f *factory) Mutate(ctx context.Context, obj runtime.Object) error {
	for _, e := range f.extras {
		if err := e.Mutate(ctx, obj); err != nil {
			return err
		}
	}
	return nil
}

func (f *factory) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	var list field.ErrorList

	conn, ok := obj.(*provisioning.Connection)
	if !ok {
		return list
	}

	// Validate title is required
	if conn.Spec.Title == "" {
		list = append(list, field.Required(
			field.NewPath("spec", "title"),
			"title is required",
		))
	}

	// Check if connection type is supported
	var foundExtra Extra
	for _, e := range f.extras {
		if e.Type() == conn.Spec.Type {
			foundExtra = e
			break
		}
	}
	if foundExtra == nil {
		// Return error message matching Build() error format: "connection type %q is not supported"
		list = append(list, field.Invalid(
			field.NewPath("spec", "type"),
			conn.Spec.Type,
			fmt.Sprintf("connection type %q is not supported", conn.Spec.Type),
		))
		// Return early if type is not supported - no point validating further
		return list
	}

	// Check if connection type is enabled
	if _, enabled := f.enabled[conn.Spec.Type]; !enabled {
		// Return error message matching Build() error format: "connection type %q is not enabled"
		list = append(list, field.Invalid(
			field.NewPath("spec", "type"),
			conn.Spec.Type,
			fmt.Sprintf("connection type %q is not enabled", conn.Spec.Type),
		))
		// Return early if type is not enabled - no point validating further
		return list
	}

	// Validate using registered extras
	for _, e := range f.extras {
		list = append(list, e.Validate(ctx, obj)...)
	}
	return list
}

var (
	_ Factory = (*factory)(nil)
)
