---
aliases:
  - /docs/sources/panels/transform-data/apply-transformation-to-data/
title: Apply a transformation to data
weight: 20
---

# Apply a transformation function to data

The following steps guide you in applying a transformation to data. This documentation does not include steps for each type of transformation. For a complete list of transformations, refer to [Reference: Transformation functions]({{< relref "../reference-transformation-functions.md" >}}).

## Before you begin

- [Add a query]({{< relref "../query-a-data-source/add-a-query.md" >}}).

**To apply a transformation function to data**:

1. Navigate to the panel where you want to add one or more transformations.
1. Click the panel title and then click **Edit**.
1. Click the **Transform** tab.
1. Click a transformation.

   A transformation row appear where you configure the transformation options. For more information about how to configure a transformation, refer to [Reference: Transformation functions]({{< relref "../reference-transformation-functions.md" >}}).

   For information about available calculations, refer to [Reference: Calculations]({{< relref "../reference-calculation-types.md" >}}).

1. To apply another transformation, click **Add transformation**.

   This transformation acts on the result set returned by the previous transformation.

   {{< figure src="/static/img/docs/transformations/transformations-7-0.png" class="docs-image--no-shadow" max-width= "1100px" >}}

## Options

- **Config query**: Select the query that returns the data you want to use as configuration.
- **Apply to**: Select what fields or series to apply the configuration to.
- **Apply to options**: Usually a field type or field name regex depending on what option you selected in **Apply to**.
