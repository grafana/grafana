package featuremgmt

import (
	"context"
	"errors"

	authlib "github.com/grafana/authlib/authn"
	"github.com/stretchr/testify/mock"
)

type fakeTokenExchangeClient struct {
	expectedErr error
	*mock.Mock
}

func (c *fakeTokenExchangeClient) Exchange(ctx context.Context, r authlib.TokenExchangeRequest) (*authlib.TokenExchangeResponse, error) {
	c.Called(ctx, r)
	if c.expectedErr != nil {
		return nil, errors.New("error signing token")
	}
	return &authlib.TokenExchangeResponse{Token: "signed-token"}, c.expectedErr
}
