---
description: Use label-based access control (LBAC) to restrict team access to logs, metrics, and traces on a single data source.
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
title: Label-based access control (LBAC) for data sources
weight: 100
review_date: 2026-09-22
---

# Label-based access control (LBAC) for data sources

Label-based access control (LBAC) for data sources gives you fine-grained, team-based access to a single data source. Instead of maintaining many data sources with different permissions, you configure access rules on one data source so each team queries only the logs, metrics, or traces they're allowed to see. Grafana applies these rules based on a user's team memberships.

LBAC for data sources helps you:

- **Control access by team:** Filter logs, metrics, and traces using rules you assign to each team.
- **Simplify data source management:** Consolidate many data sources into one.
- **Reuse dashboards:** Share the same dashboard across teams, each with its own access rules.

This approach addresses two common challenges:

- **Too many data sources:** Reduce the number of data sources per instance from hundreds to one.
- **One dashboard, many teams:** Let teams use the same dashboard with different access rules.

## Supported data sources

LBAC for data sources supports Loki and Prometheus. Support for additional data sources may be added in future updates.

| Data source | Grafana Cloud  | Grafana Enterprise                             | Cross-tenant query support |
| ----------- | -------------- | ---------------------------------------------- | -------------------------- |
| Loki        | GA             | GA (requires GEL - Grafana Enterprise Logs)    | No                         |
| Prometheus  | GA             | GA (requires GEM - Grafana Enterprise Metrics) | No                         |
| Tempo       | Public preview | Not available                                  | No                         |

{{< admonition type="note" >}}
Traces support is in public preview and available on Grafana Cloud only. LBAC is available for traces that Grafana Cloud can access, whether those traces come from a Tempo data source configured for a Grafana Cloud stack or the built-in Cloud Traces database.
{{< /admonition >}}

On Grafana Enterprise, LBAC for data sources requires Grafana Enterprise Metrics (GEM) for metrics or Grafana Enterprise Logs (GEL) for logs.

## How LBAC works

Grafana adds LBAC rules to each query request through the data source. It evaluates a user's team memberships and applies the rules assigned to those teams, so the backend returns only the data the user is permitted to see.

If you configure multiple rules for a team, Grafana evaluates each rule separately and the results include any data that matches any of the rules.

You define rules with label or attribute selectors:

- **Logs:** Control access to log lines using LogQL label selectors, such as `namespace` or `cluster`.
- **Metrics:** Control access to metric data points using label selectors, such as `job` or `region`, including the `__name__` label.
- **Traces:** Control access to spans using attribute selectors with resource scope attributes, such as `resource.service.name` or `resource.env`.

Traces use attributes, not labels, and rely on TraceQL-style attribute selectors rather than LogQL. Traces LBAC is available only at the team level.

This flexibility lets teams use the same data source for multiple use cases while keeping access boundaries secure.

### Data source permissions

Data source permissions control who can query the data source. Administrators set these permissions at the data source level, and all teams and users assigned to the data source inherit them.

Only users with the `Admin` data source permission can edit LBAC rules in the **Data source permissions** tab, because changing LBAC rules requires the same access level as editing data source permissions.

Grafana recommends that you dedicate a single data source to LBAC so you have a clear separation between data sources that use LBAC and those that don't. Grant only the `query` permission to teams that need access, and create a separate data source without LBAC for teams that need full access.

## Before you begin

Before you configure LBAC for data sources, ensure you have the following:

- **A supported backend:** Grafana Cloud (Mimir for metrics, Loki for logs) or Grafana Enterprise with GEM or GEL. No feature toggle is required for Loki and Prometheus.
- **Admin data source permissions:** You need the `Admin` permission on the data source to create or edit LBAC rules.
- **A manually created data source:** You must create the LBAC-enabled data source manually. Provisioning the data source itself isn't supported.

Remove any label selectors from the Cloud Access Policy (CAP) configured for the data source. Otherwise, the CAP label selectors override your LBAC for data sources rules. For more information, refer to [Use label-based access control (LBAC) with access policies](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/label-access-policies/).

## Limitations

LBAC for data sources has the following limitations:

- A data source supports a limited number of rules, depending on their size. The upper limit is around 500 to 600 rules.
- If a user's team has no LBAC rules, that user can query all logs or metrics.
- If an administrator belongs to a team with LBAC rules, those rules apply to the administrator's requests.
- Cloud Access Policy (CAP) LBAC rules override LBAC for data sources rules. CAPs are the access controls from Grafana Cloud.
- You must create these data sources manually. Provisioning the data source isn't supported, although you can provision LBAC rules with Terraform. Refer to [Provision LBAC rules](#provision-lbac-rules).
- Cross-tenant querying isn't supported.
- For Tempo and Cloud Traces, LBAC is available only at the team level. Data source-level LBAC rules, configured through cloud access policies, aren't supported for traces, and rules are restricted to resource scope attributes.

## Set up LBAC for data sources

To set up LBAC for data sources, refer to the guide for your data source:

- **Loki:** [Configure LBAC for the Loki data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/configure-teamlbac-for-loki/)
- **Prometheus:** [Configure LBAC for the Prometheus data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/configure-teamlbac-for-prometheus/)
- **Tempo or Cloud Traces:** [Configure team LBAC for Tempo](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/configure-teamlbac-for-tempo/)

For guidance on writing rules for a supported data source, refer to [Create LBAC for data sources rules](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/create-teamlbac-rules/).

## Provision LBAC rules

You create the LBAC-enabled data source manually, but you can provision the LBAC rules for an existing data source with the Grafana Terraform provider. Grafana recommends using the Terraform provider to manage rules. Refer to [Resource: grafana_data_source_config_lbac_rules](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source_config_lbac_rules) for configuration details.
