---
description: Label based data access for Loki given Teams
keywords:
  - grafana
  - licensing
  - enterprise
labels:
  products:
    - enterprise
    - cloud
title: Team LBAC
weight: 100
---

# Team LBAC

{{% admonition type="note" %}}
Creating Team LBAC rules is available for preview preview for logs with Loki in Grafana Cloud. Report any unexpected behavior to the Grafana Support team.
{{% /admonition %}}

Grafana's new Team LBAC (Label Based Access Control) feature for Loki is a significant enhancement that simplifies and streamlines data source access management based on team memberships. Users wanting fine grained access to their logs in Loki, can now configure their users access based on their team memberships.

**LBAC**
control access to data based on labels. In the context of Loki, it is a way to control access to logs based on labels. Users wanting fine grained access to their logs in Loki, can now configure their users access based on their team memberships via **LogQL**.

This feature addresses two common challenge faced by Grafana users:

1. High volume of Grafana Cloud datasource. Team LBAC lets Grafana Admins reduce the total volume of data sources per instance from hundreds, to one.
1. Hard for teams to share dashboard. Team LBAC lets Grafana Teams share the same dashboard despite different access control rules.

For setting up Team LBAC for a Loki data source, refer to [Configure Team LBAC]({{< relref "./congiure-teamlbac-for-loki/" >}}).

## Team LBAC rules

Team LBAC rules are added to the http request to Loki data source. Setting up Team LBAC rules for any team will apply those rules to the teams.
Users who want teams with a specific set of label selectors can add rules for each team.

Configuring multiple rules for a team, each rule is evaluated separately. If a team has `X` number of rules configured for it, all rules will be applied to the request and the result will be the an "OR" operation of the `X` number of rules.

Only users with data source Admin permissions can edit LBAC rules at the data source permissions tab. Changing LBAC rules requires the same access level as editing data source permissions (admin permission for data source).

For setting up Team LBAC Rules for the data source, refer to [Create Team LBAC rules]({{< relref "./create-teamlbac-rules/" >}}).

> "Can I use CAPs (cloud access policies) together with TeamLBAC rules?"
> No, CAP (cloud access policies) always have precedence. If there are any CAP LBAC configured for the same datasource and there are TeamLBAC rules configured, then only the CAP LBAC will be applied.

Cloud access policies are the access controls from Grafana Cloud, the CAP configured for loki should only to be used to gain read access to the logs.

> "If administrator forget to add rule for a team, what happens?"
> The teams that does not have a rule applied to it, would be able to query all logs if `query` permissions are setup for their role within Grafana.

**Note:** A user who is part of a team within Grafana without a rule will be able to query all logs if there are role based queriying setup.
