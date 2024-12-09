# Support bundles

Support bundles comprehensively collect the information needed for debugging. Specifically, support bundles function as an archive that contains one file per collector that is selected by the user.

Generally, collectors are functions in the backend that collect information about the service in which they are running. Services can register collectors during their initialization.

## Find the support bundle information

Support bundles are generated from information located in the Grafana UI's online documentation. Under **Help**, select the **Support bundle** menu.

## Add a new support bundle collector

To add a new support bundle collector, follow these steps which use the usage stats service as an example. For example:

1. Import the support bundles registry in the service's `ProvideService` function:

   ```go
   type UsageStats struct {
   	...
   }

   func ProvideService(
   	...
   	bundleRegistry supportbundles.Service, // Bundle registry
   ) (*UsageStats, error)
   ```

   After importing the support bundle, run `make gen-go` to wire the registry to the service.

1. Implement the collector. For example:

   ```go
   func (uss *UsageStats) supportBundleCollector() supportbundles.Collector {
   	return supportbundles.Collector{
   		UID:               "usage-stats", // Unique ID for the collector
   		DisplayName:       "Usage statistics", // Display name for the collector in the UI
   		Description:       "Usage statistics of the Grafana instance", // Description for the collector in the UI
   		IncludedByDefault: false, // Indicates whether the collector is included by default in the support bundle and can't be deselected. Usually you want this to be false.
   		Default:           false, // Indicates whether the collector is selected by default in the support bundle. User can still deselect it.
   		// Function that will actually collect the file during the support bundle generation.
   		Fn: func(ctx context.Context) (*supportbundles.SupportItem, error) {
   			// Add your service's logic to collect the information you need
   			// In this example we collect the usage stats and place them appropriately in JSON
   			// This helps us get information about the usage of the Grafana instance
   			report, err := uss.GetUsageReport(context.Background())
   			if err != nil {
   				return nil, err
   			}

   			data, err := json.Marshal(report)
   			if err != nil {
   				return nil, err
   			}

   			return &supportbundles.SupportItem{
   				// Filename of the file in the archive
   				// Can be any extension (most commonly, .json and .md).
   				Filename:  "usage-stats.json",
   				FileBytes: data, // []byte of the file
   			}, nil
   		},
   	}
   }
   ```

1. Register the collector in the service's `ProvideService` function. For example:

```go
func ProvideService(
    ...
) (*UsageStats, error) {
	s := &UsageStats{
        //	...
	}

	bundleRegistry.RegisterSupportItemCollector(s.supportBundleCollector())

	return s, nil
}
```
