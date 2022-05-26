---
aliases:
  - /docs/sources/panels/add-panels-dynamically/configure-repeating-panels/
title: Configure repeating panels
weight: 20
---

# Configure repeating panels

For queries that return multiple values for a variable, you can configure Grafana to dynamically add panels based on those values.

> **Note:** Repeating panels require variables to have one or more items selected; you cannot repeat a panel zero times to hide it.

## Before you begin

- Ensure that the query includes a multi-value variable.

**To configure repeating panels**:

1. Edit the panel you want to repeat.

1. On the display options pane, expand **Panel options > Repeat options**.

1. Select a `direction`.

   - Choose `horizontal` to arrange panels side-by-side. Grafana adjusts the width of a repeated panel. Currently, you cannot mix other panels on a row with a repeated panel.
   - Choose `vertical` to arrange panels in a column. The width of repeated panels is the same as the original, repeated panel.

1. To propagate changes to all panels, reload the dashboard.
