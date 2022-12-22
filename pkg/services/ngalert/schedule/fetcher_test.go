package schedule

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestHashUIDs(t *testing.T) {
	r := []*models.AlertRule{{UID: "foo"}, {UID: "bar"}}
	assert.Equal(t, uint64(0xade76f55c76a1c48), hashUIDs(r))
	// expect the same hash irrespective of order
	r = []*models.AlertRule{{UID: "bar"}, {UID: "foo"}}
	assert.Equal(t, uint64(0xade76f55c76a1c48), hashUIDs(r))
	// expect a different hash
	r = []*models.AlertRule{{UID: "bar"}}
	assert.Equal(t, uint64(0xd8d9a5186bad3880), hashUIDs(r))
	// slice with no items
	r = []*models.AlertRule{}
	assert.Equal(t, uint64(0xcbf29ce484222325), hashUIDs(r))
	// a different slice with no items should have the same hash
	r = []*models.AlertRule{}
	assert.Equal(t, uint64(0xcbf29ce484222325), hashUIDs(r))
}
