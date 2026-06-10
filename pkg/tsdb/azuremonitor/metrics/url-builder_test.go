package metrics

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestBuildResourceURI(t *testing.T) {
	t.Run("AzureMonitor Resource URI Builder", func(t *testing.T) {
		t.Run("when there is no resource uri", func(t *testing.T) {
			ub := &UrlBuilder{
				DefaultSubscription: new("default-sub"),
				MetricDefinition:    new("Microsoft.Web/serverFarms"),
				ResourceGroup:       new("rg"),
				ResourceName:        new("rn1"),
			}

			result, err := ub.BuildResourceURI()
			if err != nil {
				return
			}
			url := *result
			assert.Equal(t, "/subscriptions/default-sub/resourceGroups/rg/providers/Microsoft.Web/serverFarms/rn1", url)
		})

		t.Run("when only resource uri is provided it returns the resource URI", func(t *testing.T) {
			ub := &UrlBuilder{
				ResourceURI: new("/subscriptions/sub/resource/uri"),
			}

			url, err := ub.BuildResourceURI()
			assert.Nil(t, err)
			assert.Equal(t, "/subscriptions/sub/resource/uri", *url)
		})

		t.Run("when resource uri and legacy fields are provided the legacy fields are ignored", func(t *testing.T) {
			ub := &UrlBuilder{
				ResourceURI:         new("/subscriptions/sub/resource/uri"),
				DefaultSubscription: new("default-sub"),
				ResourceGroup:       new("rg"),
				MetricNamespace:     new("Microsoft.NetApp/netAppAccounts/capacityPools/volumes"),
				ResourceName:        new("rn1/rn2/rn3"),
			}

			url, err := ub.BuildResourceURI()
			assert.Nil(t, err)
			assert.Equal(t, "/subscriptions/sub/resource/uri", *url)
		})

		t.Run("Legacy URL Builder params", func(t *testing.T) {
			t.Run("when metric definition is in the short form", func(t *testing.T) {
				ub := &UrlBuilder{
					DefaultSubscription: new("default-sub"),
					ResourceGroup:       new("rg"),
					MetricNamespace:     new("Microsoft.Compute/virtualMachines"),
					ResourceName:        new("rn"),
				}

				url, err := ub.BuildResourceURI()
				assert.Nil(t, err)
				assert.Equal(t, "/subscriptions/default-sub/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/rn", *url)
			})
		})

		t.Run("when metric definition is in the short form and a subscription is defined", func(t *testing.T) {
			ub := &UrlBuilder{
				DefaultSubscription: new("default-sub"),
				Subscription:        new("specified-sub"),
				ResourceGroup:       new("rg"),
				MetricNamespace:     new("Microsoft.Compute/virtualMachines"),
				ResourceName:        new("rn"),
			}

			url, err := ub.BuildResourceURI()
			assert.Nil(t, err)
			assert.Equal(t, "/subscriptions/specified-sub/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/rn", *url)
		})

		t.Run("when metric definition is Microsoft.Storage/storageAccounts/blobServices", func(t *testing.T) {
			ub := &UrlBuilder{
				DefaultSubscription: new("default-sub"),
				ResourceGroup:       new("rg"),
				MetricNamespace:     new("Microsoft.Storage/storageAccounts/blobServices"),
				ResourceName:        new("rn1"),
			}

			result, err := ub.BuildResourceURI()
			if err != nil {
				return
			}
			url := *result
			assert.Equal(t, "/subscriptions/default-sub/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/blobServices/default", url)
		})

		t.Run("when metric definition is Microsoft.Storage/storageAccounts/tableServices", func(t *testing.T) {
			ub := &UrlBuilder{
				DefaultSubscription: new("default-sub"),
				ResourceGroup:       new("rg"),
				MetricNamespace:     new("Microsoft.Storage/storageAccounts/tableServices"),
				ResourceName:        new("rn1/default"),
			}

			url, err := ub.BuildResourceURI()
			assert.Nil(t, err)
			assert.Equal(t, "/subscriptions/default-sub/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/tableServices/default", *url)
		})

		t.Run("when metric definition is Microsoft.Storage/storageAccounts/fileServices", func(t *testing.T) {
			ub := &UrlBuilder{
				DefaultSubscription: new("default-sub"),
				ResourceGroup:       new("rg"),
				MetricNamespace:     new("Microsoft.Storage/storageAccounts/fileServices"),
				ResourceName:        new("rn1/default"),
			}

			url, err := ub.BuildResourceURI()
			assert.Nil(t, err)
			assert.Equal(t, "/subscriptions/default-sub/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/fileServices/default", *url)
		})

		t.Run("when metric definition is Microsoft.NetApp/netAppAccounts/capacityPools/volumes", func(t *testing.T) {
			ub := &UrlBuilder{
				DefaultSubscription: new("default-sub"),
				ResourceGroup:       new("rg"),
				MetricNamespace:     new("Microsoft.NetApp/netAppAccounts/capacityPools/volumes"),
				ResourceName:        new("rn1/rn2/rn3"),
			}

			url, err := ub.BuildResourceURI()
			assert.Nil(t, err)
			assert.Equal(t, "/subscriptions/default-sub/resourceGroups/rg/providers/Microsoft.NetApp/netAppAccounts/rn1/capacityPools/rn2/volumes/rn3", *url)
		})

		t.Run("when metricDefinition or metricNamespace is not defined an error is thrown", func(t *testing.T) {
			ub := &UrlBuilder{}

			_, err := ub.BuildResourceURI()
			if err == nil {
				t.Errorf("Expected an error, but got nil")
			} else {
				expectedErrorMessage := "no metricNamespace or metricDefiniton value provided"
				if err.Error() != expectedErrorMessage {
					t.Errorf("Expected error message %s, but got %s", expectedErrorMessage, err.Error())
				}
			}
		})

		t.Run("provider extraction from metricNamespaceArray", func(t *testing.T) {
			ub := &UrlBuilder{
				DefaultSubscription: new("default-sub"),
				MetricNamespace:     new("provider1/service1"),
				ResourceGroup:       new("rg"),
				ResourceName:        new("rn1/rn2/rn3"),
			}
			expectedProvider := "provider1"

			uri, err := ub.BuildResourceURI()
			if err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
			if uri == nil {
				t.Fatalf("Expected non-nil uri")
				return
			}
			if !strings.Contains(*uri, expectedProvider) {
				t.Errorf("Expected provider %v in uri %v", expectedProvider, *uri)
			}
		})

		t.Run("when metricNamespace is not in the correct format", func(t *testing.T) {
			ub := &UrlBuilder{
				DefaultSubscription: new("default-sub"),
				MetricNamespace:     new("invalidformat"),
			}

			_, err := ub.BuildResourceURI()
			if err == nil || err.Error() != "metricNamespace is not in the correct format" {
				t.Errorf("Expected error: metricNamespace is not in the correct format")
			}
		})

		t.Run("when resourceNameArray index out of range", func(t *testing.T) {
			ub := &UrlBuilder{
				DefaultSubscription: new("default-sub"),
				MetricNamespace:     new("provider1/service1"),
				ResourceName:        new("rn1/rn2/rn3"),
			}

			_, err := ub.BuildResourceURI()
			if err != nil {
				t.Errorf("Unexpected error: %v", err)
			}

			ub = &UrlBuilder{
				DefaultSubscription: new("default-sub"),
				MetricNamespace:     new("provider1/service1/service2"),
				ResourceName:        new(""),
			}

			_, err = ub.BuildResourceURI()
			if err == nil || err.Error() != "resourceNameArray does not have enough elements" {
				t.Errorf("Expected error: resourceNameArray does not have enough elements")
			}
		})
	})
}
