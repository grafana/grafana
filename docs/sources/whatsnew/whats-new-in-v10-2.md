---
description: Feature and improvement highlights for Grafana v10.2
keywords:
  - grafana
  - new
  - documentation
  - '10.2'
  - release notes
labels:
products:
  - cloud
  - enterprise
  - oss
title: What's new in Grafana v10.2
weight: -39
---

# What’s new in Grafana v10.2

Welcome to Grafana 10.2! Read on to learn about changes to ...

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md). For the specific steps we recommend when you upgrade to v10.2, check out our [Upgrade Guide]({{< relref "../upgrade-guide/upgrade-v10.2/index.md" >}}).

<!-- Template below

> Add on-prem only features here. Features documented in the Cloud What's new will be copied from those release notes.

## Feature
<!-- Name of contributor -->
<!-- _[Generally available | Available in private/public preview | Experimental] in Grafana [Open Source, Enterprise]_
Description. Include an overview of the feature and problem it solves, and where to learn more (like a link to the docs).
{{% admonition type="note" %}}
You must use relative references when linking to docs within the Grafana repo. Please do not use absolute URLs. For more information about relrefs, refer to [Links and references](/docs/writers-toolkit/writing-guide/references/).
{{% /admonition %}}
-->
<!-- Add an image, GIF or video  as below

{{< figure src="/media/docs/grafana/dashboards/WidgetVizSplit.png" max-width="750px" caption="DESCRIPTIVE CAPTION" >}}

Learn how to upload images here: https://grafana.com/docs/writers-toolkit/write/image-guidelines/#where-to-store-media-assets
-->

## Transformations

As our work on improving the user experience of transforming data continues, we've also been adding new capabilities to transformations.

### Support for dashboard variables in transformations

<!-- Oscar Kilhed, Victor Marin -->

_Experimental in all editions of Grafana_

Previously the only transformation that supported [dashboard variables]({{< relref "../dashboards/variables/" >}}) was the **add field from calculation transformation**. We have now extended the support for variables to **Filter by value**, **Create heatmap**, **Histogram**, **Sort by**, **Limit**, **Filter by name** and **Join by field**. We've also made it easier to find the correct dashboard variable by displaying available variables in the fields that support variables, either in the dropdown or as a suggestion when you type **$** or press `<ctrl+space>` {{< figure src="/media/docs/grafana/transformations/completion.png" caption="Input with dashboard variable suggestions" >}}

### New modes for the add field from calculation transformation

<!-- Victor Marin -->

The add field from calculation transformation has received two new modes.

**Unary operations** let you apply mathematical operations to a field. The currently supported operations are - **Absolute value (abs)** - Returns the absolute value of a given expression. It represents its distance from zero as a positive number. - **Natural exponential (exp)** - Returns _e_ raised to the power of a given expression. - **Natural logarithm (ln)** - Returns the natural logarithm of a given expression. - **Floor (floor)** - Returns the largest integer less than or equal to a given expression. - **Ceiling (ceil)** - Returns the smallest integer greater than or equal to a given expression.
{{< figure src="/media/docs/grafana/transformations/unary-operation.png" >}}

**Row index** adds a field that represents the row index of the row.

Learn more about the add field from calculation transformation [here]({{< relref="../panels-visualizations/query-transform-data/transform-data/#add-field-from-calculation" >}})

### New transformation: Format string

<!-- Solomon Dubock, BI Squad -->

With the new format string transformation you can manipulate string fields to look nicer! The currently supported operations are.

- **Change case** changes the case of your string to upper case, lower case, sentence case, title case, pascal case, camel case or snake case.
- **Trim** removes white space characters at the start and end of your string.
- **Substring** selects a part of your string field.

Learn more about the string format transformation [here]({{< relref="./panels-visualizations/query-transform-data/transform-data/#format-string" >}})
