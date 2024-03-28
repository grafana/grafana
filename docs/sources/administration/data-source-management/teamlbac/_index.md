---
description: Label based data access for Loki given Teams
keywords:
  - grafana
  - loki
  - lbac
labels:
  products:
    - enterprise
    - cloud
title: Team LBAC
weight: 100
---

# Team LBAC

Team Label Based Access Control (LBAC) simplifies and streamlines data source access management based on team memberships.

{{< admonition type="note" >}}
Creating Team LBAC rules is available for preview for logs with Loki in Grafana Cloud.
Report any unexpected behavior to the Grafana Support team.
{{< /admonition >}}

You can configure user access based upon team memberships using LogQL.
Team LBAC controls access to logs depending on the rules set for each team.

This feature addresses two common challenges faced by Grafana users:

1. Having a high number of Grafana Cloud data sources.
   Team LBAC lets Grafana administrators reduce the total number of data sources per instance from hundreds, to one.
1. Using the same dashboard across multiple teams.
   Team LBAC lets Grafana Teams use the same dashboard with different access control rules.

To set up Team LBAC for a Loki data source, refer to [Configure Team LBAC](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/configure-teamlbac-for-loki/).

## Limitations

- If there are no Team LBAC rules for a user's team, that user can query all logs.
- If an administrator is part of a team with Team LBAC rules, those rules are applied to the administrator requests.
- Cloud Access Policies (CAP) LBAC rules override Team LBAC rules.
  Cloud Access Policies are the access controls from Grafana Cloud.
  If there are any CAP LBAC rules configured for the same data source, then only the CAP LBAC rules are applied.

  You must remove any label selectors from your Cloud Access Policies to use Team LBAC.
  For more information about CAP label selectors, refer to [Use label-based access control (LBAC) with access policies](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/label-access-policies/).

## Data source permissions

Data source permissions allow the users access to query the data source.
Administrators set the permissions at the data source level.
All the teams and users that are part of the data source inherit those permissions.

## Recommended setup

It's recommended that you create a single Loki data source for using Team LBAC rules so you have a clear separation of data sources using Team LBAC and those that aren't.
All teams should have with only teams having `query` permission.
You should create another Loki data source configured without Team LBAC for full access to the logs.

## Team LBAC rules

Grafana adds Team LBAC rules to the HTTP request via the Loki data source.

If you configure multiple rules for a team, each rule is evaluated separately.
Query results include lines that match any of the rules.

Only users with data source `Admin` permissions can edit Team LBAC rules in the **Data source permissions** tab because changing LBAC rules requires the same access level as editing data source permissions.

To set up Team LBAC for a Loki data source, refer to [Configure Team LBAC](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/configure-teamlbac-for-loki/).
