package mocks

import (
	"github.com/aws/aws-sdk-go/service/oam"
	"github.com/stretchr/testify/mock"
)

type FakeOAMClient struct {
	mock.Mock
}

func (o *FakeOAMClient) ListSinks(input *oam.ListSinksInput) (*oam.ListSinksOutput, error) {
	args := o.Called(input)
	return args.Get(0).(*oam.ListSinksOutput), args.Error(1)
}

func (o *FakeOAMClient) ListAttachedLinks(input *oam.ListAttachedLinksInput) (*oam.ListAttachedLinksOutput, error) {
	args := o.Called(input)
	return args.Get(0).(*oam.ListAttachedLinksOutput), args.Error(1)
}
