+++
title = "Select a data source"
weight = 1
+++

# Select a data source

The data source selector is a drop-down list. Click it to select a data source you have added. When you create a panel, Grafana automatically selects your default data source. For more information about adding data sources, refer to [Add a data source]({{< relref "../datasources/add-a-data-source.md" >}}).

{{< figure src="/static/img/docs/queries/data-source-selector-7-0.png" class="docs-image--no-shadow" max-width="250px" >}}

In addition to the data sources that you have configured in your Grafana, there are three special data sources available:

- **Grafana -** A built-in data source that generates random walk data. Useful for testing visualizations and running experiments.
- **Mixed -** Select this to query multiple data sources in the same panel. When this data source is selected, Grafana allows you to select a data source for every new query that you add.
  - The first query will use the data source that was selected before you selected **Mixed**.
  - You cannot change an existing query to use the Mixed Data Source.
- **Dashboard -** Select this to use a result set from another panel in the same dashboard.
