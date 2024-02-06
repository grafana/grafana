---
aliases:
description: Label based data access for Loki given Teams
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

## Team LBAC rules

Team LBAC rules are added to the http request to Loki data source. Setting up Team LBAC rules for any team will apply those rules to the teams.
Users who want teams with a specific set of label selectors can add rules for each team.

Configuring multiple rules for a team, each rule is evaluated separately. If a team has `X` number of rules configured for it, all rules will be applied to the request and the result will be the an "OR" operation of the `X` number of rules.

Only users with data source Admin permissions can edit LBAC rules at the data source permissions tab. Changing LBAC rules requires the same access level as editing data source permissions (admin permission for data source).

> "Can I use CAPs (cloud access policies) together with TeamLBAC rules?"
> No, CAP (cloud access policies) always have precedence. If there are any CAP LBAC configured for the same datasource and there are TeamLBAC rules configured, then only the CAP LBAC will be applied.

Cloud access policies are the access controls from Grafana Cloud, the CAP configured for loki should only to be used to gain read access to the logs.

> "If administrator forget to add rule for a team, what happens?"
> The teams that does not have a rule applied to it, would be able to query all logs if `query` permissions are setup for their role within Grafana.

**Note:** A user who is part of a team within Grafana without a rule will be able to query all logs if there are role based queriying setup.

#### Best practices

We recommend you only add team LBAC permissions for teams that should use the data source and remove default `Viewer` and `Editor` query permissions.

We recommend for a first setup, setting up as few rules for each team as possible and make them additive and not negated.

For validating the rules, we recommend testing the rules in the Loki Explore view. This will allow you to see the logs that would be returned for the rule.

#### Scenarios

**Scenario 1: One rule setup for each team**

We have two teams, Team A and Team B. Loki access is setup with `Admin` roles to have `Admin` permission only.

- Team A has a rule `namespace="dev"`.

- Team B has a rule `namespace="prod"`.

A user that is part of Team A will have access to logs that match `namespace="dev"`.

A user that is part of Team B will have access to logs that match `namespace="prod"`.

**Scenario 2: Multiple rules setup for one team**

We have two teams, Team A and Team B. Loki access is setup with `Admin` roles having `Admin` permission.

- Team A has rule `cluster="us-west-0", namespace="dev|prod"` configured.

- Team B has rule `cluster="us-west-0", namespace="!prod"` configured.

A user that is only part of Team A will have access to logs that match `cluster="us-west-0" AND (namespace="dev" OR namespace="prod")`.

A user that is only part of Team B will have access to logs that match `cluster="us-west-0" AND namespace!="prod"`.

A user that is part of both Team A and Team B will have access to logs that match `cluster="us-west-0" AND (namespace="dev" OR namespace="prod") OR (is this true?) (cluster="us-west-0" AND namespace!="prod")`.

A user that is **not** part of any Team with `Editor/Viewer` role will not have access to query any logs.

**Important**

A `Admin` user that is part of a Team with will only have access to that teams logs

A `Admin` user that is not part of any Team with `Admin` role will have access to all logs

**Scenario 3: Rules that overlap**

We have two teams, Team A and Team B.

- Team A has a rule `namespace="dev"`.

- Team B has a rule `namespace!="dev"`.

A user in Team A will have access to logs that match `namespace="dev"`.

A user in Team b will have access to logs that match `namespace!="dev"`.

> _NOTE:_ A user that is part of Team A and Team B will have access to all logs that match `namespace="dev"` `OR` `namespace!="dev"`.

**Scenario 4: One rule setup for a Team**

We have two teams, Team A and Team B. Loki access is setup with `Editor`, `Viewer` roles to have `Query` permission.

- Team A has a rule `namespace="dev"` configured.

- Team B does not have a rule configured for it.

A user that is part of Team A will have access to logs that match `namespace="dev"`.

A user that is part of Team A and part of Team B will have access to logs that match `namespace="dev"`.

A user that is not part of Team A and part of Team B, that is `Editor` or `Viewer` will have access to all logs (due to the query permission for the user).

## Setting up Team LBAC rules

To be able to use Team LBAC rules, you need to enable the feature toggle `teamHTTPHeaders` on your Grafana instance. Contact support to enable the feature toggle for you.

### Prerequisites

### Required permissions

Ensure you have administrative access to Grafana Cloud (GCom) and the necessary permissions to configure data sources and access policies. You will need to have access to the teams you want to configure rules for.

To configure Team LBAC rules, you need to have admin permissions for the data source and edit permissions on the teams you want to configure rules for.

### Steps to Configure Team LBAC Rules for a team

1. Navigate to your Loki datasource
1. Navigate to the permissions tab
   - Here, you'll find the Team LBAC rules section.
1. Add a Team LBAC Rule
   - Add a new rule for the team in the Team LBAC rules section.
1. Define Label Selector for the Rule
   - Add a label selector to the rule. Refer to Loki query documentation for guidance on the types of log selections you can specify.

### Steps to Configure Team LBAC Rules for a new Loki data source

1. Access Loki data sources details for your stack through grafana.com
1. Copy Loki Details and Create a CAP
   - Copy the details of your Loki setup.
   - Create a Cloud Access Policy (CAP) for the Loki data source in grafana.com.
   - Ensure the CAP includes `logs:read` permissions.
1. Create a New Loki Data Source
   - In Grafana, proceed to add a new data source and select Loki as the type.
1. Navigate back to the Loki data source
   - Set up the Loki data source using basic authentication. Use the userID as the username. Use the generated CAP token as the password.
   - Save and connect.
1. Navigate to Data Source Permissions
   - Go to the permissions tab of the newly created Loki data source. Here, you'll find the Team LBAC rules section.
1. Add a Team LBAC Rule
   - Add a new rule for the team in the Team LBAC rules section.
1. Define Label Selector for the Rule
   - Add a label selector to the rule. Refer to Loki query documentation for guidance on the types of log selections you can specify.
