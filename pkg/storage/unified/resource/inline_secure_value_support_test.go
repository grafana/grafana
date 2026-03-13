package resource

import (
	"context"

	"github.com/stretchr/testify/mock"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

type mockInlineSecureValueSupport struct {
	mock.Mock
}

func newMockInlineSecureValueSupport(t interface {
	mock.TestingT
	Cleanup(func())
}) *mockInlineSecureValueSupport {
	m := &mockInlineSecureValueSupport{}
	m.Mock.Test(t)
	t.Cleanup(func() { m.AssertExpectations(t) })
	return m
}

func (m *mockInlineSecureValueSupport) CanReference(ctx context.Context, owner common.ObjectReference, names ...string) error {
	args := make([]any, 0, len(names)+2)
	args = append(args, ctx, owner)
	for _, name := range names {
		args = append(args, name)
	}
	return m.Called(args...).Error(0)
}

func (m *mockInlineSecureValueSupport) CreateInline(ctx context.Context, owner common.ObjectReference, value common.RawSecureValue) (string, error) {
	args := m.Called(ctx, owner, value)
	return args.String(0), args.Error(1)
}

func (m *mockInlineSecureValueSupport) DeleteWhenOwnedByResource(ctx context.Context, owner common.ObjectReference, names ...string) error {
	args := make([]any, 0, len(names)+2)
	args = append(args, ctx, owner)
	for _, name := range names {
		args = append(args, name)
	}
	return m.Called(args...).Error(0)
}
