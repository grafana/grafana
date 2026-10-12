package secret

import (
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/storage/unified/apistore/securevalue"
)

type MockInlineSecureValueSupport = securevalue.MockInlineSecureValueSupport

func NewMockInlineSecureValueSupport(t interface {
	mock.TestingT
	Cleanup(func())
}) *MockInlineSecureValueSupport {
	return securevalue.NewMockInlineSecureValueSupport(t)
}
