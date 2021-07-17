package managedstream

import (
	"testing"

	"github.com/golang/mock/gomock"

	"github.com/stretchr/testify/require"
)

type testPublisher struct {
	orgID int64
	t     *testing.T
}

func (p *testPublisher) publish(orgID int64, _ string, _ []byte) error {
	require.Equal(p.t, p.orgID, orgID)
	return nil
}

func TestNewManagedStream(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	publisher := &testPublisher{orgID: 1, t: t}
	c := NewManagedStream("a", publisher.publish, NewMemoryFrameCache(), NewMockRuleCacheGetter(mockCtrl))
	require.NotNil(t, c)
}
