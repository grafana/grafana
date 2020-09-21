+++
title = "Apply a Transformation"
type = "docs"
[menu.docs]
identifier = "apply_transformation"
parent = "tranformations"
weight = 300
+++


# Apply a transformation

You can apply transformations from the Transform tab of the Grafana panel editor, which is located next to the Queries tab.

To apply a transformation:

1. Navigate to the panel where you want to add one or more transformations.
1. Click the panel title and then click **Edit**.
1. Click the **Transform** tab.
1. Click a transformation to select it.

   A transformation row displays. You can configure the transformation options here. For more information, refer to [Transformation types and options]({{< relref "types-options.md" >}}).

2. Click **Add transformation** to apply another transformation.

   This next transformation acts on the result set returned by the previous transformation.

   {{< docs-imagebox img="/img/docs/transformations/transformations-7-0.png" class="docs-image--no-shadow" max-width= "1100px" >}}

3. Optionaly, click the trash can icon to remove a transformation.

   To troubleshoot any issue, click the bug icon. For more information, see [Debug  transformations]({{< relref "debug.md" >}}).