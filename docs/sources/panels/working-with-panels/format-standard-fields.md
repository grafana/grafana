---
aliases:
  - /docs/grafana/latest/panels/working-with-panels/format-standard-fields/
  - /docs/sources/panels/working-with-panels/format-standard-fields/
title: Format a standard field
weight: 40
---

# Format a standard field

The data model used in Grafana, namely the [data frame]({{< relref "../../developers/plugins/data-frames/" >}}), is a columnar-oriented table structure that unifies both time series and table query results. Each column within this structure is called a _field_. A field can represent a single time series or table column.

Field options allow you to change how the data is displayed in your visualizations. Options and overrides that you apply do not change the data, they change how Grafana displays the data. When you change an option, it is applied to all fields, meaning all series or columns. For example, if you change the unit to percentage, then all fields with numeric values are displayed in percentages.

For a complete list of field formatting options, refer to [Standard field definitions]({{< relref "../standard-field-definitions/" >}}).

> You can apply standard options to most built-in Grafana panels. Some older panels and community panels that have not updated to the new panel and data model will be missing either all or some of these field options.

1. Open a dashboard, click the panel title, and click **Edit**.

1. In the panel display options pane, locate the **Standard options** section.

1. Select the standard options you want to apply.

   For more information about standard options, refer to [Standard field definitions]({{< relref "../standard-field-definitions/" >}}).

1. To preview your change, click outside of the field option box you are editing or press **Enter**.
