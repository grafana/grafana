package resourcetest

import (
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/storage/unified/resourceclient/resourceclienttest"
)

type MockResourceClient = resourceclienttest.MockResourceClient

func NewMockResourceClient(t interface {
	mock.TestingT
	Cleanup(func())
}) *MockResourceClient {
	return resourceclienttest.NewMockResourceClient(t)
}
