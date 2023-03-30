# Support bundles

Support bundles are a way to collect all the information needed to debug a problem.
They are generated from the support bundle menu in the UI under the Help section.

The support bundle is an archive that contains one file per collector selected by
the user.

Collectors are functions in the backend that collect information about the service they are running in.
Services can register collectors during their initialization.

## Adding a new support bundle collector

To add a new support bundle collector, you need to follow these steps,
we'll use the usage stats service as an example:

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

2. `make gen-go` will then be able to wire the registry to the service.

3. Implement the collector

```go
func (uss *UsageStats) supportBundleCollector() supportbundles.Collector {
	return supportbundles.Collector{
		UID:               "usage-stats", // unique ID for the collector
		DisplayName:       "Usage statistics", // display name for the collector in the UI
		Description:       "Usage statistics of the Grafana instance", // description for the collector in the UI
		IncludedByDefault: false, // whether the collector is included by default in the support bundle and can't be deselected. Most times you want this to be false.
		Default:           false, // whether the collector is selected by default in the support bundle. User can still deselect it.
        // Function that will actually collect the file during the support bundle generation.
		Fn: func(ctx context.Context) (*supportbundles.SupportItem, error) {
            // Add your service's logic to collect the information you need
            // In this example we are collecting the usage stats and marshalling them to JSON
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
                // filename of the file in the archive
                // can be any extension. (most common is .json and .md)
				Filename:  "usage-stats.json",
				FileBytes: data, // []byte of the file
			}, nil
		},
	}
}
```

4. Register the collector in the service's `ProvideService` function:

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
