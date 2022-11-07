package metrics

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestURLBuilder(t *testing.T) {
	t.Run("AzureMonitor URL Builder", func(t *testing.T) {
		t.Run("when only resource uri is provided it returns resource/uri/providers/microsoft.insights/metrics", func(t *testing.T) {
			ub := &urlBuilder{
				ResourceURI: "/subscriptions/sub/resource/uri",
			}

			url := ub.BuildMetricsURL()
			assert.Equal(t, "/subscriptions/sub/resource/uri/providers/microsoft.insights/metrics", url)
		})

		t.Run("when resource uri and legacy fields are provided the legacy fields are ignored", func(t *testing.T) {
			ub := &urlBuilder{
				ResourceURI:         "/subscriptions/sub/resource/uri",
				DefaultSubscription: "default-sub",
				ResourceGroup:       "rg",
				MetricNamespace:     "Microsoft.NetApp/netAppAccounts/capacityPools/volumes",
				ResourceName:        "rn1/rn2/rn3",
			}

			url := ub.BuildMetricsURL()
			assert.Equal(t, "/subscriptions/sub/resource/uri/providers/microsoft.insights/metrics", url)
		})

		t.Run("Legacy URL Builder params", func(t *testing.T) {
			t.Run("when metric definition is in the short form", func(t *testing.T) {
				ub := &urlBuilder{
					DefaultSubscription: "default-sub",
					ResourceGroup:       "rg",
					MetricNamespace:     "Microsoft.Compute/virtualMachines",
					ResourceName:        "rn",
				}

				url := ub.BuildMetricsURL()
				assert.Equal(t, "/subscriptions/default-sub/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/rn/providers/microsoft.insights/metrics", url)
			})

			t.Run("when metric definition is in the short form and a subscription is defined", func(t *testing.T) {
				ub := &urlBuilder{
					DefaultSubscription: "default-sub",
					Subscription:        "specified-sub",
					ResourceGroup:       "rg",
					MetricNamespace:     "Microsoft.Compute/virtualMachines",
					ResourceName:        "rn",
				}

				url := ub.BuildMetricsURL()
				assert.Equal(t, "/subscriptions/specified-sub/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/rn/providers/microsoft.insights/metrics", url)
			})

			t.Run("when metric definition is Microsoft.Storage/storageAccounts/blobServices", func(t *testing.T) {
				ub := &urlBuilder{
					DefaultSubscription: "default-sub",
					ResourceGroup:       "rg",
					MetricNamespace:     "Microsoft.Storage/storageAccounts/blobServices",
					ResourceName:        "rn1/default",
				}

				url := ub.BuildMetricsURL()
				assert.Equal(t, "/subscriptions/default-sub/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/blobServices/default/providers/microsoft.insights/metrics", url)
			})

			t.Run("when metric definition is Microsoft.Storage/storageAccounts/fileServices", func(t *testing.T) {
				ub := &urlBuilder{
					DefaultSubscription: "default-sub",
					ResourceGroup:       "rg",
					MetricNamespace:     "Microsoft.Storage/storageAccounts/fileServices",
					ResourceName:        "rn1/default",
				}

				url := ub.BuildMetricsURL()
				assert.Equal(t, "/subscriptions/default-sub/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/fileServices/default/providers/microsoft.insights/metrics", url)
			})

			t.Run("when metric definition is Microsoft.NetApp/netAppAccounts/capacityPools/volumes", func(t *testing.T) {
				ub := &urlBuilder{
					DefaultSubscription: "default-sub",
					ResourceGroup:       "rg",
					MetricNamespace:     "Microsoft.NetApp/netAppAccounts/capacityPools/volumes",
					ResourceName:        "rn1/rn2/rn3",
				}

				url := ub.BuildMetricsURL()
				assert.Equal(t, "/subscriptions/default-sub/resourceGroups/rg/providers/Microsoft.NetApp/netAppAccounts/rn1/capacityPools/rn2/volumes/rn3/providers/microsoft.insights/metrics", url)
			})

			t.Run("when metric definition is Microsoft.Storage/storageAccounts/blobServices", func(t *testing.T) {
				ub := &urlBuilder{
					DefaultSubscription: "default-sub",
					ResourceGroup:       "rg",
					MetricNamespace:     "Microsoft.Storage/storageAccounts/blobServices",
					ResourceName:        "rn1",
				}

				url := ub.buildResourceURI()
				assert.Equal(t, "/subscriptions/default-sub/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/blobServices/default", url)
			})
		})
	})
}
