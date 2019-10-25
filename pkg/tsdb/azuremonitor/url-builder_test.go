package azuremonitor

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestURLBuilder(t *testing.T) {
	Convey("AzureMonitor URL Builder", t, func() {

		Convey("when metric definition is in the short form", func() {
			ub := &urlBuilder{
				DefaultSubscription: "default-sub",
				ResourceGroup:       "rg",
				MetricDefinition:    "Microsoft.Compute/virtualMachines",
				ResourceName:        "rn",
			}

			url := ub.Build()
			So(url, ShouldEqual, "default-sub/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/rn/providers/microsoft.insights/metrics")
		})

		Convey("when metric definition is in the short form and a subscription is defined", func() {
			ub := &urlBuilder{
				DefaultSubscription: "default-sub",
				Subscription:        "specified-sub",
				ResourceGroup:       "rg",
				MetricDefinition:    "Microsoft.Compute/virtualMachines",
				ResourceName:        "rn",
			}

			url := ub.Build()
			So(url, ShouldEqual, "specified-sub/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/rn/providers/microsoft.insights/metrics")
		})

		Convey("when metric definition is Microsoft.Storage/storageAccounts/blobServices", func() {
			ub := &urlBuilder{
				DefaultSubscription: "default-sub",
				ResourceGroup:       "rg",
				MetricDefinition:    "Microsoft.Storage/storageAccounts/blobServices",
				ResourceName:        "rn1/default",
			}

			url := ub.Build()
			So(url, ShouldEqual, "default-sub/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/blobServices/default/providers/microsoft.insights/metrics")
		})

		Convey("when metric definition is Microsoft.Storage/storageAccounts/fileServices", func() {
			ub := &urlBuilder{
				DefaultSubscription: "default-sub",
				ResourceGroup:       "rg",
				MetricDefinition:    "Microsoft.Storage/storageAccounts/fileServices",
				ResourceName:        "rn1/default",
			}

			url := ub.Build()
			So(url, ShouldEqual, "default-sub/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/fileServices/default/providers/microsoft.insights/metrics")
		})
	})
}
