---
aliases:
  - ../datasources/datasource_permissions/team_ldap
  - ../datasources/datasource_permissions/teamldap
  - ../enterprise/datasource_permissions/team_ldap
  - ../enterprise/datasource_permissions/teamldap
  - ../permissions/datasource_permissions/team_ldap
  - ../permissions/datasource_permissions/teamldap
description: Data source permissions for Teams for Grafana administrators
labels:
  products:
    - enterprise
    - cloud
title: Data source permissions for Team LDAP
weight: 100
---

# Team LBAC

Grafana's new Team LBAC (Attribute-Based Access Control) feature for Loki is a significant enhancement that simplifies and streamlines data source access management based on team memberships. Users wanting fine grained access to data sources such as Loki with X amount of teams with different levels of access can make use of Team LBAC. 

This feature addresses a common challenge faced by Grafana users: managing multiple data source connections for different teams. Previously, this led to the creation of numerous connections and duplicate dashboards, hampering scalability and user experience. With Team LBAC, users can now configure custom headers based on team memberships, leveraging existing header-based LBAC, while also offering flexibility for other data sources and additional configurations like rate limiting.

## Team LBAC rules

Users who want teams with a specific set of label selectors can add rules for each team. Team LBAC rules have no upper limit as to how many you can configure per team. 

Team LBAC rules are applied to the request from the data source to Loki. The rules are applied for teams that have rules setup, for the teams that do not have a rule and no default rule setup, no rule will be configured and those teams will be able to query all logs.

Users who want LBAC rules to be applied to all teams can add a rule for `default`. This rule will be applied to all teams without a rule configured. Once a team has a rule configured for it, the `default` rule will be overruled and no longer apply to that team.

Configuring multiple rules for a team acts the same way as CAP rules, each rule is evaluated separately. If a team has two rules configured for it, both rules will be applied to the request and the result will be the [logical disjunction](https://en.wikipedia.org/wiki/Logical_disjunction), a "OR" operation of the two rules.

**Scenario 1: Default rule**
We have two teams, Team A and Team B.

A `default` rule is configured `.*`. 

Team A has a rule `namespace="auth"` configured. The `default` rule will not apply to Team A, because they have a rule set.

Team B does not have a rule configured for it. The `default` rule will apply to Team B.

**Scenario 2: No default rule**
We have two teams, Team A and Team B.

A `default` rule is **not** configured. 

Team A has a rule `namespace="auth"` configured. This rule will be applied to Team A.

Team B does not have a rule configured for it. No rule applied and they get access to all logs.

**Scenario 3: Two or more rules configured for a team**
We have two teams, Team A and Team B.

A `default` rule is configured `namespace!=security`. 

Team A has no rule. The `default` rule will apply to Team A.

Team B have two rules `namespace="auth"` and another rule `namespace="security"`. For Team B, they would see logs that match either `namespace="auth"` OR `namespace="security"`. 

## Setting up Team LBAC rules

To be able to use Team LBAC rules, you need to enable the feature toggle `teamHTTPHeaders` on your Grafana instance. Contact support to enable the feature toggle for you.

**TODO:**
For you to be able to use Team LBAC rules from Grafana, there cannot be only label selectors configured

### Prerequisites

### Required permissions
Ensure you have administrative access to Grafana Cloud (GCom) and the necessary permissions to configure data sources and access policies. You should also have access to the teams you want to configure rules for.

TODO: add required permissions

### Steps to Configure Team LBAC Rules
1. Navigate to your Loki datasource
1. Navigate to the permissions tab
    - Here, you'll find the Team LBAC rules section.
1. Add a Team LBAC Rule
    - If a relevant team doesn't exist, create one.
    - Add a new rule for the team in the Team LBAC rules section.
1. Define Label Selector for the Rule
    - Add a label selector to the rule.  Refer to Loki query documentation for guidance on the types of log selections you can specify.

### Steps to Configure Team LBAC Rules for a new Loki data source
1. Access Loki Details in GCom
1. Copy Loki Details and Create a CAP
    - Copy the details of your Loki setup.  Create a Cloud Access Policy (CAP) for the Loki tenant in GCom.
    - Ensure the CAP includes logs:read permissions.
1. Create a New Loki Data Source
    - In Grafana, proceed to add a new data source and select Loki as the type.
1. Configure Basic Auth for the Loki Data Source
    - Set up the Loki data source using basic authentication.  Use the userID as the username.  Use the generated CAP token as the password.
1. Navigate to Data Source Permissions
    - Go to the permissions tab of the newly created Loki data source.  Here, you'll find the Team LBAC rules section.
1. Add a Team LBAC Rule
    - If a relevant team doesn't exist, create one.
    - Add a new rule for the team in the Team LBAC rules section.
1. Define Label Selector for the Rule
    - Add a label selector to the rule.  Refer to Loki query documentation for guidance on the types of log selections you can specify.
