package datasource

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/admission"
	"k8s.io/kube-openapi/pkg/validation/strfmt"
	"k8s.io/kube-openapi/pkg/validation/validate"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

// Validate implements builder.APIGroupValidation.
func (b *DataSourceAPIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	fmt.Printf("Calling validate???\n")
	return nil
}

// Mutate implements builder.APIGroupMutation.
func (b *DataSourceAPIBuilder) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	obj := a.GetObject()

	if b.schemaProvider == nil || obj == nil || a.GetOperation() == admission.Connect {
		return nil // This is normal for sub-resource
	}

	ds, ok := obj.(*datasourceV0.DataSource)
	if !ok {
		return fmt.Errorf("expected datasource object")
	}

	info, err := b.schemaProvider()
	if err != nil {
		return err
	}
	if info.DataSourceSpec != nil {
		validate := validate.NewSchemaValidator(info.DataSourceSpec, nil, "", strfmt.Default)
		results := validate.Validate(ds.Spec) // will fail!
		for _, err := range results.Errors {
			fmt.Printf("ERROR: %+v\n", err)
		}
		for _, err := range results.Warnings {
			fmt.Printf("WARNING: %+v\n", err)
		}
	}
	if len(info.SecureValues) > 0 {
		fmt.Printf("TODO, validate secure values")
	}

	// TODO... call the plugin mutation hook
	return nil // TODO! replace with app helpers
}
