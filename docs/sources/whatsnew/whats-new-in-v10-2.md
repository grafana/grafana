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

## Calculate visualization min/max individually per field

<!-- Oscar Kilhed -->

_Generally available in Grafana_

When visualizing multiple fields with a wide spread of values, calculating the min/max value of the visualization based on all fields can hide useful details.
{{< figure src="/media/docs/grafana/panels-visualizations/globalminmax.png" caption="Stat panel visualization with min/max calculated from all fields" > }}
In this example in the stats panel, it's hard to get an idea of how the values of each series relates to the historical values of that series. The threshold of 10% is exceeded by the A-series even though the A-series is below 10% of its historical maximum.

Now, you can automatically calculate the min/max of each visualized field, based on the lowest and highest value of the individual field! This setting is available in the standard options in most visualizations.

{{< figure src="/media/docs/grafana/panels-visualizations/localminmax.png" caption="Stat panel visualization with min/max calculated per field" > }}
In this example, using the same data, with the min and max calculated for each individual field, we get a much better understanding of how the current value relates to the historical values. The A-series no longer exceeds the 10% threshold, it is in fact at a historical low!

This is not only useful in the stat panel. Gauge panel, bar gauge, status history, table cells formatted by thresholds, and gauge table cells all benefit from this addition!

## Add Dashboard and Datasource permissions to Service accounts

<!-- Jo Guerreiro -->

_Generally available in Grafana_

Service accounts allow you to create a token that can be used to authenticate with Grafana.
This token can be used to access Grafana's API, and can be used to access data sources and dashboards that the service account has access to.

In this release, we have added the ability to assign dashboard and datasource permissions to service accounts.
This means that you can now create a service account that can be used to access a specific dashboard or datasource and nothing else.

{{< figure src="/media/docs/grafana/screenshot-grafana-10-2-sa-managed-permissions.png" caption="Datasource permissions in 10.2" > }}

This is useful if you want to limit the access service accounts have to your Grafana instance.

## Role mapping support for Google OIDC

<!-- Jo Guerreiro -->

_Generally available in Grafana_

You can now map Google groups to Grafana organizational roles when using Google OIDC.
This is useful if you want to limit the access users have to your Grafana instance.

Support has also been added for controlling allowed groups when using Google OIDC.

Refer to the [Google Authentication documentation]({{< relref "../setup-grafana/configure-security/configure-authentication/google/index.md">}} to learn how to use these new options.
