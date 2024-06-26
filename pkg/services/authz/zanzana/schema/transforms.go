package schema

import (
	_ "embed"
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	language "github.com/openfga/language/pkg/go/transformer"
)

func TransformToModel(dsl string) (*openfgav1.AuthorizationModel, error) {
	parsedAuthModel, err := language.TransformDSLToProto(dsl)
	if err != nil {
		return nil, fmt.Errorf("failed to transform dsl to model: %w", err)
	}

	return parsedAuthModel, nil
}

func TransformToDSL(model *openfgav1.AuthorizationModel) (string, error) {
	return language.TransformJSONProtoToDSL(model)
}

func EqualModels(a, b *openfgav1.AuthorizationModel) bool {
	aDsl, err := TransformToDSL(a)
	if err != nil {
		fmt.Println("a err", err)
		return false
	}

	bDsl, err := TransformToDSL(b)
	if err != nil {
		fmt.Println("b err", err)
		return false
	}

	fmt.Println(aDsl)
	fmt.Println(bDsl)

	return aDsl == bDsl
}
