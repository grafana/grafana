---
aliases:
  - /docs/sources/panels/format-data/map-a-special-value/
title: Map a special value
weight: 50
---

# Map a special value

Map a special value when you want to format uncommon, boolean, or empty values.

## Before you begin

- [Add a panel to a dashboard]({{< relref "../working-with-panels/add-panel.md" >}}).

**To map a special value**:

1. Edit the panel for which you want to map a special value.
1. In panel display options, locate the **Value mappings** section and click **Add value mappings**.
1. Click **Add a new mapping** and then select **Special**.
1. Select the special value for Grafana to match. Options include:
   - Null
   - NaN (Not a Number)
   - Null + NaN
   - True
   - False
   - Empty
1. (Optional) Enter display text.
1. (Optional) Set the color.
1. Click **Update** to save the value mapping.

![Map a value](/static/img/docs/value-mappings/map-special-value-8-0.png)
