package schema

import (
	_ "embed"
	"fmt"

	pb "github.com/openfga/api/proto/openfga/v1"
	language "github.com/openfga/language/pkg/go/transformer"
)

//go:embed schema.fga
var DSL string

func TransformToModel(dsl string) (*pb.AuthorizationModel, error) {
	parsedAuthModel, err := language.TransformDSLToProto(dsl)
	if err != nil {
		return nil, fmt.Errorf("failed to transform due to %w", err)
	}

	return parsedAuthModel, nil
}
