package testcases

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// ResourceMigratorTestCase defines the interface for testing a resource migrator.
type ResourceMigratorTestCase interface {
	// Name returns the test case name
	Name() string
	// Resources returns the GVRs that this migrator handles
	Resources() []schema.GroupVersionResource
	// Setup creates test resources in legacy storage (Mode0)
	Setup(t *testing.T, helper *apis.K8sTestHelper)
	// Verify checks that resources exist (or don't exist) in unified storage
	Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool)
}

// verifyResourceCount verifies that the expected number of resources exist in K8s storage
func verifyResourceCount(t *testing.T, client *apis.K8sResourceClient, expectedCount int) {
	t.Helper()

	l, err := client.Resource.List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err)

	resources, err := meta.ExtractList(l)
	require.NoError(t, err)
	require.Equal(t, expectedCount, len(resources))
}

// verifyResource verifies that a resource with the given UID exists in K8s storage
func verifyResource(t *testing.T, client *apis.K8sResourceClient, uid string, shouldExist bool) {
	t.Helper()

	_, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
	if shouldExist {
		require.NoError(t, err)
	} else {
		require.Error(t, err)
	}
}
