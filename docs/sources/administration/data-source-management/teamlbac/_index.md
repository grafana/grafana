---
description: Label based data access for Teams
keywords:
  - grafana
  - loki
  - mimir
  - tempo
  - traces
labels:
  products:
    - enterprise
    - cloud
title: Label Based Access Control (LBAC) for data sources
weight: 100
---

# Label Based Access Control (LBAC) for data sources

Label Based Access Control (LBAC) for data sources simplifies and streamlines data source access management based on team memberships.
Label-Based Access Control (LBAC) allows fine-grained access control to data sources by filtering logs or metrics based on labels. It lets administrators configure access rules for teams, ensuring that users only query data relevant to their assigned permissions.

## Supported data sources

LBAC for data sources is currently supported for Loki and Prometheus.

{{< admonition type="note" >}}
Traces support is in public preview and available on Grafana Cloud only. Team LBAC is available for traces that Grafana Cloud can access, whether those traces are available through a Tempo data source configured for a Grafana Cloud stack or the built-in Cloud Traces database.
{{< /admonition >}}

Support for additional data sources may be added in future updates.

| Data source | Grafana Cloud  | Grafana Enterprise                             | Cross-tenant query support |
| ----------- | -------------- | ---------------------------------------------- | -------------------------- |
| Loki        | GA             | GA (requires GEL - Grafana Enterprise Logs)    | ❌                         |
| Prometheus  | GA             | GA (requires GEM - Grafana Enterprise Metrics) | ❌                         |
| Tempo       | Public preview | Not available                                  | ❌                         |

{{< admonition type="note" >}}
For enterprise this feature requires Grafana Enterprise Metrics (GEM) or Grafana Enterprise Logs (GEL) to function.
{{< /admonition >}}

LBAC for data sources offers:

- Team-based access control using `LogQL` rules.
- Simplified data source management by consolidating multiple sources into one.
- Dashboard reuse across teams with tailored access.

You can configure user access based upon team memberships using `LogQL`.
LBAC for data sources controls access to logs or metrics depending on the rules set for each team.

This feature addresses two common challenges faced by Grafana users:

1. Having a high number of Grafana Cloud data sources.
   LBAC for data sources lets Grafana administrators reduce the total number of data sources per instance from hundreds, to one.
1. Using the same dashboard across multiple teams.
   LBAC for data sources lets Grafana Teams use the same dashboard with different access control rules.

To set up LBAC for data sources for a Loki data source, refer to [Configure LBAC for Loki Data Source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/configure-teamlbac-for-loki/).
To set up LBAC for data sources for a Prometheus data source, refer to [Configure LBAC for Prometheus Data Source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/configure-teamlbac-for-prometheus/).
To set up LBAC for data sources for Cloud Traces or Tempo data source, refer to [Configure team LBAC for Tempo](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/configure-teamlbac-for-tempo/).

## Logs, metrics, and traces filtering with LBAC

LBAC for data sources enables you to filter access for logs, metrics, and traces. By defining rules with label or attribute selectors, you can specify:

- **Logs**: Control access to log lines using LogQL queries with labels such as `namespace` or `cluster`.
- **Metrics**: Control access to metric data points using LogQL with labels such as `job` or `region` and access for metrics `__name__`.
- **Traces**: Control access to spans using attribute selectors with resource scope attributes such as `resource.service.name` or `resource.env`.

Traces use attributes, not labels, for access control, and rely on TraceQL-style attribute selectors rather than LogQL. Traces LBAC is available only at the team level.

This flexibility allows teams to use the same data source for multiple use cases while maintaining secure access boundaries.

## Limitations

- There is a set number of rules to be configured within a data source, depending on the size of the rules.
  - Around ~500-600 rules is the upper limit.
- If there are no LBAC for data sources rules for a user's team, that user can query all logs or metrics.
- If an administrator is part of a team with LBAC for data sources rules, those rules are applied to the administrator requests.
- Cloud Access Policy (CAP) LBAC rules override LBAC for data sources rules.
  CAP are the access controls from Grafana Cloud.
- Note that these data sources must be created manually - provisioning is not yet supported.
- Cross-tenant querying is currently not supported
- For Tempo and Cloud Traces, LBAC is available only at the team level. Data source-level LBAC rules, configured through cloud access policies, aren't supported for traces. Rules are restricted to resource scope attributes.

You must remove any label selectors from your Cloud Access Policy that is configured for the data source, otherwise the CAP label selectors override the LBAC for data sources rules. For more information about CAP label selectors, refer to [Use label-based access control (LBAC) with access policies](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/label-access-policies/).

## Data source permissions

- Data source permissions allow the users access to query the data source.
- Administrators set the permissions at the data source level.
- All the teams and users that are part of the data source inherit those permissions.

## Recommended setup

It's recommended that you create a single data source for using LBAC for data sources rules so you have a clear separation of data sources using LBAC for data sources and those that aren't.
All teams should have with only teams having `query` permission.
You should create another data source configured without LBAC for data sources for full access.

## LBAC rules

Grafana adds LBAC for data sources rules to the HTTP request via the data source.

If you configure multiple rules for a team, each rule is evaluated separately.
Query results include lines that match any of the rules.

Only users with data source `Admin` permissions can edit LBAC for data sources rules in the **Data source permissions** tab because changing LBAC rules requires the same access level as editing data source permissions.

To set up LBAC for data sources for a data source, refer to [Configure LBAC for data sources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/configure-teamlbac-for-loki/).

## Provisioning of LBAC rules

We recommend using our Terraform provider to set up provisioning for [Resource data source config LBAC rules](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source_config_lbac_rules). Refer to our provider documentation to learn how to configure rules for a data source.
