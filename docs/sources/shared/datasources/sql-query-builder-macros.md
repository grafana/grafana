---
headless: true
labels:
  products:
    - enterprise
    - oss
---

#### Macros

You can enable macros support in the select clause to create time-series queries.

{{< docs/experimental product="Macros support in visual query builder" featureFlag="`sqlQuerybuilderFunctionParameters`" >}}

Use the **Data operations** drop-down to select a macro like `$__timeGroup` or `$__timeGroupAlias`.
Select a time column from the **Column** drop-down and a time interval from the **Interval** drop-down to create a time-series query.

{{< figure src="/media/docs/grafana/data-sources/screenshot-sql-builder-time-series-query.png" class="docs-image--no-shadow" caption="SQL query builder time-series query" >}}

You can also add custom value to the **Data operations**.
For example, a function that's not in the drop-down list.
This allows you to add any number of parameters.
