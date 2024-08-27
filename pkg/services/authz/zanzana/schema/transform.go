package schema

import (
	_ "embed"
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	language "github.com/openfga/language/pkg/go/transformer"
	"google.golang.org/protobuf/encoding/protojson"
)

func TransformModulesToModel(modules []language.ModuleFile) (*openfgav1.AuthorizationModel, error) {
	parsedAuthModel, err := language.TransformModuleFilesToModel(modules, "1.2")
	if err != nil {
		return nil, fmt.Errorf("failed to transform dsl to model: %w", err)
	}

	return parsedAuthModel, nil
}

func TransformDSLToModel(dsl string) (*openfgav1.AuthorizationModel, error) {
	parsedAuthModel, err := language.TransformDSLToProto(dsl)
	if err != nil {
		return nil, fmt.Errorf("failed to transform dsl to model: %w", err)
	}

	return parsedAuthModel, nil
}

func TransformToDSL(model *openfgav1.AuthorizationModel, opts ...language.TransformOption) (string, error) {
	return language.TransformJSONProtoToDSL(model, opts...)
}

// EqualModels compares two authorization models.
// Id is not comparing since model loaded from disk doesn't contain Id.
func EqualModels(a, b *openfgav1.AuthorizationModel) bool {
	aCopy := openfgav1.AuthorizationModel{
		SchemaVersion:   a.SchemaVersion,
		TypeDefinitions: a.TypeDefinitions,
		Conditions:      a.Conditions,
	}
	aJSONBytes, err := protojson.Marshal(&aCopy)
	if err != nil {
		return false
	}

	bCopy := openfgav1.AuthorizationModel{
		SchemaVersion:   b.SchemaVersion,
		TypeDefinitions: b.TypeDefinitions,
		Conditions:      b.Conditions,
	}
	bJSONBytes, err := protojson.Marshal(&bCopy)
	if err != nil {
		return false
	}

	return string(aJSONBytes) == string(bJSONBytes)
}
