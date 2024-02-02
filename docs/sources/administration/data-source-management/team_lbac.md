---
aliases:
  - ../datasources/datasource_permissions/team_lbac
  - ../datasources/datasource_permissions/teamlbac
  - ../enterprise/datasource_permissions/team_lbac
  - ../enterprise/datasource_permissions/teamlbac
  - ../permissions/datasource_permissions/team_lbac
  - ../permissions/datasource_permissions/teamlbac
description: Data source permissions for Teams for Grafana administrators
labels:
  products:
    - enterprise
    - cloud
title: Data source permissions for Team LBAC
weight: 100
---

# Team LBAC

Grafana's new Team LBAC (Label-Based Access Control) feature for Loki is a significant enhancement that simplifies and streamlines data source access management based on team memberships. Users wanting fine grained access to data sources such as Loki with `X` amount of teams with different levels of access can make use of Team LBAC.

This feature addresses a common challenge faced by Grafana users: managing Loki data source access for different teams. Previously, this led to the creation of numerous connections and duplicate dashboards, hampering scalability and user experience. With Team LBAC, users can now configure access to specific labels based solely on team memberships.

## Team LBAC rules

Users who want teams with a specific set of label selectors can add rules for each team. Team LBAC rules have no upper limit as to how many you can configure per team.

Team LBAC rules are added to the http request to Loki data source. Setting up Team LBAC rules for any team will apply those rules to the teams.

**Note:** Any teams within Grafana without a rule will be able to query all logs if there are role based queriying setup. See <> for more information.

Configuring multiple rules for a team, each rule is evaluated separately. If a team has `X` number of rules configured for it, all rules will be applied to the request and the result will be the an "OR" operation of the `X` number of rules.

Only a data source administrator with permission access can edit LBAC rules at the data source permissions tab. Changing LBAC rules requires the same access level as editing data source permissions (admin permission for data source).

> "Can I use CAPs (cloud access policies) together with TeamLBAC rules?"
> No, CAP (cloud access policies) always have precedence. If there are any CAP LBAC configured for the same datasource and there are TeamLBAC rules configured, then only the CAP LBAC will be applied.

Cloud access policies are the access controls from Grafana Cloud, the CAP configured for loki should only to be used to gain read access to the logs.

> "If administrator forget to add rule for a team, what happens?"
> The teams that does not have a rule applied to it, would be able to query the logs if `query` permissions are setup for their role within Grafana.

#### Best practices

We recommend you only add team lbac permissions for teams that should use the data source and remove default `Viewer` and `Editor` query permissions.

For validating the rules, we recommend testing the rules in the Loki Explore view. This will allow you to see the logs that would be returned for the rule.

#### Scenarios

**Scenario 1: One rule setup for each team**

We have two teams, Team A and Team B. Loki access is setup with `Admin` roles to have `Query` permission.

- Team A has a rule `namespace="dev"`. A user that is part of Team A will have access to logs that match `namespace="dev"`.

- Team B has a rule `namespace="prod"`. A user that is part of Team B will have access to logs that match `namespace="prod"`.

**Scenario 2: One rule setup for a Team**

We have two teams, Team A and Team B. Loki access is setup with `Editor`, `Viewer` roles to have `Query` permission.

- Team A has a rule `namespace="dev"` configured. A user that is part of Team A will have access to logs that match `namespace="dev"`.

- Team B does not have a rule configured for it. A user that is part of Team B, that is `Editor` or `Viewer` will have access to all logs (due to the query permission for the user).

**Scenario 3: Multiple rules setup for one team**

We have two teams, Team A and Team B. Loki access is setup with `Admin` roles having `Admin` permission.

- Team A has rule `namespace="dev", namespace="prod"` configured. A user that is part of Team A will have access to logs that match `namespace="dev"` `AND` `namespace=prod`.

- Team B has rule `namespace!="dev", namespace="prod"` configured. A user that is part of Team B will have access to logs that match `namespace!="bi"` `AND` `namespace=prod`.

- A user that is part of Team A and Team B will have access to logs that match `(namespace="dev" AND namespace="prod") OR (namespace="dev" AND namespace!="bi")`.

**Scenario 4: Two or more rules configured for a team**

We have three teams, Team A, Team B and Team C. Team C is a new team and has no rules configured for it. Loki access is setup with `Editor` role having `Query` permission.

Team A has a rule `namespace="dev"` configured. A user with `Editor` role has access to all logs. A user that is part of Team A without `Editor` role will get all logs that match `namespace="dev"`.

Team B have two rules `namespace="dev"` and `namespace="prod"`. Team B, would be able to query all logs that match either `namespace="dev"` OR `namespace="prod"`.

Team C have no rules. Team C has a user with an `Viewer`. Team C's `Editors`, will have access to query all logs.

**Scenario 5: Rules that overlap**

We have two teams, Team A and Team B.

Team A has a rule `namespace="dev"`. A user in Team A will have access to logs that match `namespace="dev"`.

Team B has a rule `namespace!="dev"`. A user in Team b will have access to logs that match `namespace!="dev"`.

> _NOTE:_ A user that is part of Team A and Team B will have access to logs that match `namespace="dev"` `OR` `namespace!="dev"`.

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
