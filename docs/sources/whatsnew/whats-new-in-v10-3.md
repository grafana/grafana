---
description: Feature and improvement highlights for Grafana v10.3
keywords:
  - grafana
  - new
  - documentation
  - '10.3'
  - release notes
labels:
products:
  - cloud
  - enterprise
  - oss
title: What's new in Grafana v10.3
weight: -40
---

# What’s new in Grafana v10.3

Welcome to Grafana 10.3!

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md). For the specific steps we recommend when you upgrade to v10.3, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v10.3/).

<!-- Template below

> Add on-prem only features here. Features documented in the Cloud What's new will be copied from those release notes.

## Feature
<!-- Name of contributor -->
<!-- _[Generally available | Available in private/public preview | Experimental] in Grafana [Open Source, Enterprise]_
Description. Include an overview of the feature and problem it solves, and where to learn more (like a link to the docs).
{{% admonition type="note" %}}
Use full URLs for links. When linking to versioned docs, replace the version with the version interpolation placeholder (for example, <GRAFANA_VERSION>, <TEMPO_VERSION>, <MIMIR_VERSION>) so the system can determine the correct set of docs to point to. For example, "https://grafana.com/docs/grafana/latest/administration/" becomes "https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/".
{{% /admonition %}}
-->
<!-- Add an image, GIF or video  as below

{{< figure src="/media/docs/grafana/dashboards/WidgetVizSplit.png" max-width="750px" caption="DESCRIPTIVE CAPTION" >}}

Learn how to upload images here: https://grafana.com/docs/writers-toolkit/write/image-guidelines/#where-to-store-media-assets
-->

## Dashboards and visualizations

### Plot enum values in your time series visualizations

<!-- Nathan Marrs -->

_Generally available in all editions of Grafana_

You can now plot enum values in your time series visualizations. This feature is useful when you want to visualize the state of a system, such as the status of a service or the health of a device. For example, you can use this feature to visualize the status of a service as `OK`, `WARNING`, or `ERROR`. To display enum values you can [use the convert field transform](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/transform-data/#convert-field-type).

<!-- TODO: Image from gdev dashboard / link to gdev dashboard in play  -->
