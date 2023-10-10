---
labels:
  products:
    - enterprise
    - oss
title: Use Correlations Editor in Explore
weight: 70
---

# Use Correlations Editor in Explore

## Before you begin

This example walks through creating a correlation in a test data source in Explore's Correlations Editor. 

Please make sure you have setu up [a test data source]({{< relref "/docs/grafana/latest/datasources/testdata/#testdata-data-source" >}}. 


## Create a new correlation

1. Go to Explore.
1. Click on "Add to..." dropdown and select "Add correlation" button.
1. Explore is now in Correlations Editor mode indicated by blue border.
1. Select test data source.
1. Select scenario: Logs.
1. Expand log details on a row.
1. Click "correlate with hostname" button.
1. On the right pane select the same data source.
1. Select scenario: CSV Content.
1. Provide following content:

```csv
Scenario,Values
Flat,"10,10,10,10,10,10,10,10"
Spike,"10,10,10,10,10,10,10,10,10,100,10,10,10,10,10,10,10,10,10,10"
Zig-Zag,"10,100,10,100,10,100,10,100,10,100,10,100,10,100,10,100,10,100,10,100,10,100"
```

1. Run the query.
1. Click on one of the scenario names, e.g. "Zig-Zag"
1. Note that the same data source is selected.
1. Select scenario: CSV Metric Values
1. Replace **string input** with variable ${Values}
1. Note how the graph is updated with values from provided variable
1. Replace **alias** with ${Scenario}
1. Note how legend is updated with the name of selected Scenario
1. Provide label: "Run ${Scenario}"
1. Save correlation.
1. Click on any scenario name to see how values in the query are added to the query editor.
1. Note how tooltip contains scenario name.

You can apply the same steps to any data source. Correlations allow you to create links on visualizations to run dynamic queries based on selected data. 

## Test newly created correlations
