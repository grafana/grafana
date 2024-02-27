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

{{% admonition type="note" %}}
Creating Team LBAC rules is available for preview for logs with Loki in Grafana Cloud. Report any unexpected behavior to the Grafana Support team.
{{% /admonition %}}

**Current Limitation:**

- Any user with `query` permissions for a Loki data source can query all logs if there are no Team LBAC rules configured for any of the users team.
- An admin that is part of a team, would have it's Team LBAC rules applied to the request.
- Team LBAC rules will not be applied if the linked Cloud Access Policy has label selectors.

Grafana's new **Team LBAC** (Label Based Access Control) feature for Loki is a significant enhancement that simplifies and streamlines data source access management based on team memberships.

**Team LBAC** in the context of Loki, is a way to control access to logs based on labels present depending on the rules set for each team. Users wanting fine grained access to their logs in Loki, can now configure their users access based on their team memberships via **LogQL**.

This feature addresses two common challenge faced by Grafana users:

1. High volume of Grafana Cloud datasource. Team LBAC lets Grafana Admins reduce the total volume of data sources per instance from hundreds, to one.
1. Hard for teams to share dashboard. Team LBAC lets Grafana Teams share the same dashboard despite different access control rules.

For setting up Team LBAC for a Loki data source, refer to [Configure Team LBAC]({{< relref "./configure-teamlbac-for-loki/" >}}).

#### Datasource Permissions

Datasource permissions allow the users access to query the datasource. The permissions are set at the datasource level and are inherited by all the teams and users that are part of the datasource.

#### Recommended setup

We recommend to create a loki datasource dedicated for Team LBAC rules with only teams having `query` permission. This will allow you to have a clear separation of datasources for Team LBAC and the datasources that are not using Team LBAC. Another loki datasource would be setup for full access to the logs.

Ex:

1. Datasource `loki-full-access`, same setup for the loki tenant, the users querying this datasource would not have team lbac rules and have `query` permissions.
2. Datasource `loki-lbac`, same setup, the users querying the data source would have to be part of a team and a LBAC rule.

## Team LBAC rules

Team LBAC rules are added to the http request to Loki data source. Setting up Team LBAC rules for any team will apply those rules to the teams.
Users who want teams with a specific set of label selectors can add rules for each team.

Configuring multiple rules for a team, each rule is evaluated separately. If a team has `X` number of rules configured for it, all rules will be applied to the request and the result will be the an "OR" operation of the `X` number of rules.

Only users with data source Admin permissions can edit LBAC rules at the data source permissions tab. Changing LBAC rules requires the same access level as editing data source permissions (admin permission for data source).

For setting up Team LBAC Rules for the data source, refer to [Create Team LBAC rules]({{< relref "./create-teamlbac-rules/" >}}).

### FAQ

> #### "If I want a user to have full access to the logs, but they are part of a team with LBAC rules?"
>
> The user should use another loki datasource that is specifically used to have full access to the logs. See best practices.

**Note:** A user who is part of a team within Grafana with a rule will only be able to query logs with that rule.

> #### "If a team does not have a rule, what happens?"

If a team does not have a rule; any users that are part of that team having query permissions for loki will have access to **all** logs.

> #### "Can I use CAPs (cloud access policies) together with TeamLBAC rules?"

No, CAP (cloud access policies) always have precedence. If there are any CAP LBAC configured for the same datasource and there are TeamLBAC rules configured, then only the CAP LBAC will be applied.

Cloud access policies are the access controls from Grafana Cloud, the CAP configured for loki should only to be used to gain read access to the logs.

> #### "If administrator forget to add rule for a team, what happens?"

The teams that does not have a rule applied to it, would be able to query all logs if `query` permissions are setup for their role within Grafana.

**Note:** A user who is part of a team within Grafana without a rule will be able to query all logs if the user has a role with `query` permissions.
