package schema

import (
	"context"
	"encoding/json"
	"fmt"

	pb "github.com/openfga/api/proto/openfga/v1"
	openfga "github.com/openfga/go-sdk"
	language "github.com/openfga/language/pkg/go/transformer"
	"github.com/openfga/openfga/pkg/typesystem"
	"google.golang.org/protobuf/encoding/protojson"
)

func TransformToJSON(ctx context.Context, model *pb.AuthorizationModel) ([]byte, error) {
	if _, err := typesystem.NewAndValidate(ctx, model); err != nil {
		return nil, err
	}

	jsonModel, err := transformPbToModel(model)
	if err != nil {
		return nil, err
	}

	bytes, err := json.Marshal(jsonModel)
	if err != nil {
		return nil, fmt.Errorf("failed to transform due to %w", err)
	}

	return bytes, nil
}

func transformPbToModel(model *pb.AuthorizationModel) (*openfga.AuthorizationModel, error) {
	bytes, err := protojson.Marshal(model)
	if err != nil {
		return nil, fmt.Errorf("failed to transform due to %w", err)
	}

	jsonAuthModel := openfga.AuthorizationModel{}

	err = json.Unmarshal(bytes, &jsonAuthModel)
	if err != nil {
		return nil, fmt.Errorf("failed to transform due to %w", err)
	}
	return &jsonAuthModel, nil
}

func TransformToModel(dslString string) (*pb.AuthorizationModel, error) {
	parsedAuthModel, err := language.TransformDSLToProto(dslString)
	if err != nil {
		return nil, fmt.Errorf("failed to transform due to %w", err)
	}

	return parsedAuthModel, nil
}
