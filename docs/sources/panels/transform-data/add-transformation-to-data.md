---
aliases:
  - /docs/grafana/latest/panels/transform-data/add-transformation-to-data/
  - /docs/sources/panels/transform-data/add-transformation-to-data/
  - /docs/sources/panels/transform-data/apply-transformation-to-data/
  - apply-transformation-to-data/
title: Add a transformation to data
weight: 20
---

# Add a transformation function to data

The following steps guide you in adding a transformation to data. This documentation does not include steps for each type of transformation. For a complete list of transformations, refer to [Transformation functions]({{< relref "transformation-functions/" >}}).

## Before you begin

- [Add a query]({{< relref "../query-a-data-source/add-a-query/" >}}).

**To apply a transformation function to data**:

1. Navigate to the panel where you want to add one or more transformations.
1. Click the panel title and then click **Edit**.
1. Click the **Transform** tab.
1. Click a transformation.

   A transformation row appears where you configure the transformation options. For more information about how to configure a transformation, refer to [Transformation functions]({{< relref "transformation-functions/" >}}).

   For information about available calculations, refer to [Calculation types]({{< relref "../calculation-types/" >}}).

1. To apply another transformation, click **Add transformation**.

   This transformation acts on the result set returned by the previous transformation.

   {{< figure src="/static/img/docs/transformations/transformations-7-0.png" class="docs-image--no-shadow" max-width= "1100px" >}}
