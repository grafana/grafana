---
keywords:
  - correlations
  - Explore
labels:
  products:
    - enterprise
    - oss
title: Correlations
weight: 900
---

# Correlations

You can create interactive links for Explore visualizations to run queries related to presented data by setting up Correlations.

A correlation defines how data in one [data source]({{< relref "../../datasources" >}}) is used to query data in another data source.
Some examples:

- an application name returned in a logs data source can be used to query metrics related to that application in a metrics data source, or
- a user name returned by an SQL data source can be used to query logs related to that particular user in a logs data source

[Explore]({{< relref "../../explore" >}}) takes user-defined correlations to display links inside the visualizations.
You can click on a link to run the related query and see results in [Explore Split View]({{< relref "../../explore#split-and-compare" >}}).

Explore visualizations that currently support showing links based on correlations:

- [Logs Panel]({{< relref "./use-correlations-in-visualizations#correlations-in-logs-panel">}})
- [Table]({{< relref "./use-correlations-in-visualizations#correlations-in-table">}})

You can configure correlations using the **Administration > Correlation** page in Grafana or with [provisioning]({{< relref "../provisioning" >}}).

{{% admonition type="note" %}}
Correlations are available in Grafana 10.0+ as an opt-in beta feature.
Modify the Grafana [configuration file]({{< relref "../../setup-grafana/configure-grafana#configuration-file-location" >}}) to enable the `correlations` [feature toggle]({{< relref "../../setup-grafana/configure-grafana#feature_toggles" >}}) to use it.
{{% /admonition %}}

## Example of how links work in Explore once set up

{{< figure src="/static/img/docs/correlations/correlations-in-explore-10-0.gif" alt="Demonstration of following a correlation link in Grafana Explore" caption="Correlations links in Explore" >}}

See also:

{{< section >}}
