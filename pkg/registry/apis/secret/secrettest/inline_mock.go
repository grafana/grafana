package secrettest

import (
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/storage/unified/apistore/securevalue/securevaluetest"
)

type MockInlineSecureValueSupport = securevaluetest.MockInlineSecureValueSupport

func NewMockInlineSecureValueSupport(t interface {
	mock.TestingT
	Cleanup(func())
}) *MockInlineSecureValueSupport {
	return securevaluetest.NewMockInlineSecureValueSupport(t)
}
