+++
title = "Apply a transformation to data"
weight = 10
+++

# Apply a transformation to data

Prerequisites

Before you can configure and apply transformations:

- You must have entered a query that return data. For more information on queries, refer to [Queries]({{< relref "../queries.md" >}}).



Another source input...

You can apply transformations from the Transform tab of the Grafana panel editor, which is located next to the Queries tab. See also, [Debug transformations](#debug-transformations).

To apply a transformation:

1. Navigate to the panel where you want to add one or more transformations.
1. Click the panel title and then click **Edit**.
1. Click the **Transform** tab.
1. Click a transformation to select it.

   A transformation row displays. You can configure the transformation options here. For more information, refer to [Transformation types and options]({{< relref "types-options.md" >}}).

1. Click **Add transformation** to apply another transformation.

   This next transformation acts on the result set returned by the previous transformation.

   {{< figure src="/static/img/docs/transformations/transformations-7-0.png" class="docs-image--no-shadow" max-width= "1100px" >}}


Another source input...

### Options

- **Config query**: Select the query that returns the data you want to use as configuration.
- **Apply to**: Select what fields or series to apply the configuration to.
- **Apply to options**: Usually a field type or field name regex depending on what option you selected in **Apply to**.