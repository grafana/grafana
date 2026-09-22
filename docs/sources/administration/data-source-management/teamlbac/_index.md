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
menuTitle: LBAC for data sources
title: Label-based access control (LBAC) for data sources
weight: 100
review_date: 2026-09-22
---

# Label-based access control (LBAC) for data sources

Label-based access control (LBAC) for data sources controls who can query which data based on the labels attached to that data, not on which data source it lives in. Labels are the key-value pairs attached to logs and metrics, such as `namespace="prod"` or `cluster="us-east"`; traces use resource attributes, such as `resource.service.name`, instead of labels. You define label or attribute rules, assign them to teams, and Grafana filters every query so each team sees only the data that matches its rules.

Because access is enforced by these rules, you can maintain a single data source instead of many with different permissions. Grafana applies the rules based on a user's team memberships, so access follows the team.

LBAC for data sources helps you:

- **Control access by team:** Filter logs, metrics, and traces using rules you assign to each team.
- **Simplify data source management:** Consolidate hundreds of data sources into one, where each team sees only its own data.
- **Reuse dashboards:** Share the same dashboard across teams, with each team's access governed by its own rules.

## Supported data sources

LBAC for data sources is generally available for Loki and Prometheus. Traces support, through Tempo or Cloud Traces, is in public preview on Grafana Cloud. Support for additional data sources may be added in future updates.

| Data source | Grafana Cloud  | Grafana Enterprise                             | Cross-tenant query support |
| ----------- | -------------- | ---------------------------------------------- | -------------------------- |
| Loki        | GA             | GA (requires GEL - Grafana Enterprise Logs)    | No                         |
| Prometheus  | GA             | GA (requires GEM - Grafana Enterprise Metrics) | No                         |
| Tempo       | Public preview | Not available                                  | No                         |

{{< admonition type="note" >}}
LBAC is available for traces that Grafana Cloud can access, whether those traces come from a Tempo data source configured for a Grafana Cloud stack or the built-in Cloud Traces database.
{{< /admonition >}}

On Grafana Enterprise, LBAC for data sources requires Grafana Enterprise Metrics (GEM) for metrics or Grafana Enterprise Logs (GEL) for logs.

## How LBAC works

Grafana adds LBAC rules to each query request through the data source. It evaluates a user's team memberships and applies the rules assigned to those teams, so the backend returns only the data the user is permitted to see.

If you configure multiple rules for a team, Grafana evaluates each rule separately and the results include any data that matches any of the rules. Within a single rule, all selectors must match, so `{namespace="dev", cluster="us-west-0"}` returns only data that matches both labels.

You define rules with label or attribute selectors:

- **Logs:** Control access to log lines using LogQL label selectors, such as `namespace` or `cluster`.
- **Metrics:** Control access to metric data points using label selectors, such as `job` or `region`, including the `__name__` label.
- **Traces:** Control access to spans using TraceQL-style attribute selectors with resource scope attributes, such as `resource.service.name` or `resource.env`. Traces use attributes rather than labels, and traces LBAC is available only at the team level.

### Data source permissions

Data source permissions control who can query the data source. Administrators set these permissions at the data source level, and all teams and users assigned to the data source inherit them. Data source permissions grant the ability to query the data source, and LBAC rules then filter which data each team can see within that access.

Only users with the `Admin` data source permission can edit LBAC rules in the **Data source permissions** tab, because changing LBAC rules requires the same access level as editing data source permissions.

Grafana recommends that you dedicate a single data source to LBAC so you have a clear separation between data sources that use LBAC and those that don't. Grant only the `Query` permission to teams that need access, and create a separate data source without LBAC for teams that need full access.

## Before you begin

Before you configure LBAC for data sources, ensure you have the following:

- **A supported backend:** Grafana Cloud (Mimir for metrics, Loki for logs) or Grafana Enterprise with GEM or GEL. No feature toggle is required for Loki and Prometheus.
- **Admin data source permissions:** You need the `Admin` permission on the data source to create or edit LBAC rules.
- **A manually created data source:** You must create the LBAC-enabled data source manually. Provisioning the data source itself isn't supported.

Remove any label selectors from the Cloud Access Policy (CAP) configured for the data source. Otherwise, the CAP label selectors override your LBAC rules. For more information, refer to [Use label-based access control (LBAC) with access policies](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/label-access-policies/).

## Limitations

LBAC for data sources has the following limitations:

- A data source supports a limited number of rules, depending on their size. The upper limit is around 500 to 600 rules.
- If no LBAC rules apply to any of a user's teams, that user can query all logs or metrics. Because permissions are additive, a user who belongs to a team with rules and a team without rules is still restricted by the rules.
- If an administrator belongs to a team with LBAC rules, those rules apply to the administrator's requests.
- Cloud Access Policy (CAP) LBAC rules override LBAC rules. CAPs are the access controls from Grafana Cloud.
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

You create the LBAC-enabled data source manually, but you can provision the LBAC rules for an existing data source with the Grafana Terraform provider. Grafana recommends using the Terraform provider to manage rules. The [`grafana_data_source_config_lbac_rules`](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source_config_lbac_rules) resource requires Grafana v11.5.0 or later.

{{< admonition type="caution" >}}
This resource manages the entire set of LBAC rules for a data source and overwrites any existing rules. Manage all of a data source's rules in one place so you don't remove rules configured elsewhere.
{{< /admonition >}}

The following example creates a team, a Loki data source, and a rule that applies to that team:

```terraform
resource "grafana_team" "team" {
  name = "Team Name"
}

resource "grafana_data_source" "loki" {
  type                = "loki"
  name                = "loki-from-terraform"
  url                 = "https://<LOKI_URL>"
  basic_auth_enabled  = true
  basic_auth_username = "<USERNAME>"

  json_data_encoded = jsonencode({
    authType          = "default"
    basicAuthPassword = "<PASSWORD>"
  })
}

resource "grafana_data_source_config_lbac_rules" "rules" {
  datasource_uid = grafana_data_source.loki.uid
  rules = jsonencode({
    "${grafana_team.team.team_uid}" = [
      "{ cluster = \"dev-us-central-0\", namespace = \"hosted-grafana\" }",
    ]
  })

  depends_on = [
    grafana_team.team,
    grafana_data_source.loki,
  ]
}
```

Replace the following placeholders:

- _`<LOKI_URL>`_: The URL of your Loki instance.
- _`<USERNAME>`_ and _`<PASSWORD>`_: The basic authentication credentials for the data source, such as the user ID and Cloud Access Policy token.

The `rules` argument maps each team's UID to a list of LBAC rule strings. Each string uses the same label or attribute selector syntax you use in the UI.

To manage rules programmatically instead, use the [data source LBAC rules HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/datasource_lbac_rules/).
