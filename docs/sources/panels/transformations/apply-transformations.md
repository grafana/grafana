+++
title = "Apply a transformation"
type = "docs"
[menu.docs]
identifier = "apply-transformation"
parent = "transformations"
weight = 300
+++


# Apply transformations

You can apply transformations from the Transform tab of the Grafana panel editor, which is located next to the Queries tab. See also, [Debug  transformations](#debug-transformations).

To apply a transformation:

1. Navigate to the panel where you want to add one or more transformations.
1. Click the panel title and then click **Edit**.
1. Click the **Transform** tab.
1. Click a transformation to select it.

   A transformation row displays. You can configure the transformation options here. For more information, refer to [Transformation types and options]({{< relref "types-options.md" >}}).

1. Click **Add transformation** to apply another transformation.

   This next transformation acts on the result set returned by the previous transformation.

   {{< docs-imagebox img="/img/docs/transformations/transformations-7-0.png" class="docs-image--no-shadow" max-width= "1100px" >}}

## Delete a transformation

To remove a transformation that is no longer needed, click the trash can icon.

## Debug transformations

To see the input and the output result sets of the transformation, click the bug icon on the right side of the transformation row
Grafana displays the transformation debug view below the transformation row.
{{< docs-imagebox img="/img/docs/transformations/debug-transformations-7-0.png" class="docs-image--no-shadow" max-width= "1100px" >}}
