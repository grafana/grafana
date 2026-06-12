package validation

import (
	"context"
	"fmt"
	"slices"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
)

type Request[T resource.Object] struct {
	Action    resource.AdmissionAction
	Object    T
	OldObject T
}

type ValidateFunc[T resource.Object] func(ctx context.Context, req Request[T]) error

type validatorConfig[T resource.Object] struct {
	actions []resource.AdmissionAction
	fn      ValidateFunc[T]
}

type Builder[T resource.Object] struct {
	entries []validatorConfig[T]
}

func NewBuilder[T resource.Object]() *Builder[T] {
	return &Builder[T]{}
}

func (b *Builder[T]) On(actions []resource.AdmissionAction, fn ValidateFunc[T]) *Builder[T] {
	b.entries = append(b.entries, validatorConfig[T]{actions: actions, fn: fn})
	return b
}

func (b *Builder[T]) OnWrite(fn ValidateFunc[T]) *Builder[T] {
	return b.On([]resource.AdmissionAction{resource.AdmissionActionCreate, resource.AdmissionActionUpdate}, fn)
}

func (b *Builder[T]) OnDelete(fn ValidateFunc[T]) *Builder[T] {
	return b.On([]resource.AdmissionAction{resource.AdmissionActionDelete}, fn)
}

func (b *Builder[T]) Build() *simple.Validator {
	return &simple.Validator{
		ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
			applicable := make([]ValidateFunc[T], 0, len(b.entries))
			for _, e := range b.entries {
				if slices.Contains(e.actions, req.Action) {
					applicable = append(applicable, e.fn)
				}
			}
			if len(applicable) == 0 {
				return nil
			}

			request := Request[T]{Action: req.Action}

			switch req.Action {
			// req.Object won't be set on deletes
			case resource.AdmissionActionDelete:
				old, ok := req.OldObject.(T)
				if !ok {
					return fmt.Errorf("old object is not of type %T", *new(T))
				}
				request.OldObject = old
			default:
				obj, ok := req.Object.(T)
				if !ok {
					return fmt.Errorf("object is not of type %T", *new(T))
				}
				request.Object = obj
				// OldObject will be set on updates
				if req.OldObject != nil {
					request.OldObject, _ = req.OldObject.(T)
				}
			}

			for _, fn := range applicable {
				if err := fn(ctx, request); err != nil {
					return err
				}
			}
			return nil
		},
	}
}
