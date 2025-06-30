package mocks

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/service/oam"
	"github.com/stretchr/testify/mock"
)

type FakeOAMClient struct {
	mock.Mock
}

func (o *FakeOAMClient) ListSinks(_ context.Context, input *oam.ListSinksInput, _ ...func(*oam.Options)) (*oam.ListSinksOutput, error) {
	args := o.Called(input)
	return args.Get(0).(*oam.ListSinksOutput), args.Error(1)
}

func (o *FakeOAMClient) ListAttachedLinks(_ context.Context, input *oam.ListAttachedLinksInput, _ ...func(*oam.Options)) (*oam.ListAttachedLinksOutput, error) {
	args := o.Called(input)
	return args.Get(0).(*oam.ListAttachedLinksOutput), args.Error(1)
}
