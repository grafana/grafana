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

// FIXME(kalleep): We need to figure out a better way to compare equality of two different
// authorization model. For now the easiest way I found to comparing different schemas was
// to convert them into their json representation but this requires us to first convert dsl into
// openfgav1.AuthorizationModel and then later parse it as json.
// Comparing parsed authorization model with authorization model from store directly by parsing them as
// as json won't work because stored model will have some fields set such as id that are not present in a parsed
// dsl from disk.
func EqualModels(a, b string) bool {
	astr, err := language.TransformDSLToJSON(a)
	if err != nil {
		return false
	}

	bstr, err := language.TransformDSLToJSON(b)
	if err != nil {
		return false
	}

	return astr == bstr
}
