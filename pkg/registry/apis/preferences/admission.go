package preferences

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/admission"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
)

func (b *APIBuilder) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	switch a.GetOperation() {
	case admission.Create, admission.Update:
		// ignore anything that is not CREATE | UPDATE
	default:
		return nil
	}

	obj := a.GetObject()
	if obj == nil {
		return nil
	}

	switch a.GetResource().Resource {
	case "stars":
		stars, ok := obj.(*preferences.Stars)
		if !ok {
			return fmt.Errorf("expected stars object: (%T)", obj)
		}
		stars.Spec.Normalize()
		return nil
	}
	return nil
}
