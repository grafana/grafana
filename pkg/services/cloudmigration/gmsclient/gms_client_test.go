package gmsclient

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/stretchr/testify/assert"
)

func Test_buildBasePath(t *testing.T) {
	t.Parallel()

	tests := []struct {
		description string
		domain      string
		clusterSlug string
		expected    string
	}{
		{
			description: "domain starts with http://localhost, should return domain",
			domain:      "http://localhost:8080",
			clusterSlug: "anything",
			expected:    "http://localhost:8080",
		},
		{
			description: "domain doesn't start with http://localhost, should build a string using the domain and clusterSlug",
			domain:      "gms-dev",
			clusterSlug: "us-east-1",
			expected:    "https://cms-us-east-1.gms-dev/cloud-migrations",
		},
	}
	for _, tt := range tests {
		t.Run(tt.description, func(t *testing.T) {
			assert.Equal(t, tt.expected, buildBasePath(tt.domain, tt.clusterSlug))
		})
	}
}

func Test_PreventRapidGMSQueries(t *testing.T) {
	c := NewGMSClient("http://localhost:8080", time.Second).(*gmsClientImpl)
	// Attempt a query, expect an error but time should be saved
	_, err := c.GetSnapshotStatus(context.Background(), cloudmigration.CloudMigrationSession{ClusterSlug: "bogus", StackID: 12345, AuthToken: "bogus"}, cloudmigration.CloudMigrationSnapshot{GMSSnapshotUID: "bogus"})
	assert.Error(t, err)

	// sleep long enough for the polling period to elapse
	time.Sleep(1500 * time.Millisecond)

	// Attempt another query and get another error because we try again
	_, err = c.GetSnapshotStatus(context.Background(), cloudmigration.CloudMigrationSession{ClusterSlug: "bogus", StackID: 12345, AuthToken: "bogus"}, cloudmigration.CloudMigrationSnapshot{GMSSnapshotUID: "bogus"})
	assert.Error(t, err)

	// Don't wait for long enough
	time.Sleep(10 * time.Millisecond)

	// Attempt another query and get back a canned response
	resp, err := c.GetSnapshotStatus(context.Background(), cloudmigration.CloudMigrationSession{ClusterSlug: "bogus", StackID: 12345, AuthToken: "bogus"}, cloudmigration.CloudMigrationSnapshot{GMSSnapshotUID: "bogus"})
	assert.NoError(t, err)
	assert.Equal(t, cloudmigration.SnapshotStateUnknown, resp.State)
}
