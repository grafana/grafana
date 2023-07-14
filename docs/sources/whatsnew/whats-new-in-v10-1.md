---
description: Feature and improvement highlights for Grafana v10.1
keywords:
  - grafana
  - new
  - documentation
  - '10.1'
  - release notes
title: What's new in Grafana v10.1
weight: -38
---

# What’s new in Grafana v10.1

Welcome to Grafana 10.1! Read on to learn about changes to search and navigation, dashboards and visualizations, and security and authentication.

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md). For the specific steps we recommend when you upgrade to v10.1, check out our [Upgrade Guide]({{< relref "../upgrade-guide/upgrade-v10.1/index.md" >}}).

<!-- Template below
## Feature
<!-- Name of contributor -->
<!-- [Generally available | Available in private/public preview | Experimental] in Grafana [Open Source, Enterprise, Cloud Free, Cloud Pro, Cloud Advanced]
Description. Include an overview of the feature and problem it solves, and where to learn more (like a link to the docs).
{{% admonition type="note" %}}
You must use relative references when linking to docs within the Grafana repo. Please do not use absolute URLs. For more information about relrefs, refer to [Links and references](/docs/writers-toolkit/writing-guide/references/).
{{% /admonition %}}
-->

## Dashboards and visualizations

### Disconnect values in time series, trend, and state timeline visualizations

_Generally available in all editions of Grafana._

<!-- Nathan Marrs -->

You can now choose whether to set a threshold above which values in the data should be disconnected. This can be useful in cases where you have sensors that report a value at a set interval, but you want to disconnect the values when the sensor does not respond. This feature complements the existing [connect null values functionality]({{< relref "../panels-visualizations/visualizations/time-series/#connect-null-values" >}}).

To learn more, refer to our [disconnect values documentation]({{< relref "../panels-visualizations/visualizations/time-series/#disconnect-values" >}}).

{{< figure src="/media/docs/grafana/screenshot-grafana-10-1-disconnect-values-examples.png" max-width="750px" caption="Disconnect values in time series, trend, and state timeline visualizations" >}}
