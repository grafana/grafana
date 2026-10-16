package resource

import (
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/storage/unified/resourceclient"
)

type MockResourceClient = resourceclient.MockResourceClient

func NewMockResourceClient(t interface {
	mock.TestingT
	Cleanup(func())
}) *MockResourceClient {
	return resourceclient.NewMockResourceClient(t)
}
