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

# Team LBAP

Grafana's new Team LBAC (Attribute-Based Access Control) feature for Loki is a significant enhancement that simplifies and streamlines data source access management based on team memberships. Users wanting fine grained access to data sources such as Loki with X amount of teams with different levels of access can make use of Team LDAP. 

This feature addresses a common challenge faced by Grafana users: managing multiple data source connections for different teams. Previously, this led to the creation of numerous connections and duplicate dashboards, hampering scalability and user experience. With Team LBAC, users can now configure custom headers based on team memberships, leveraging existing header-based LBAC, while also offering flexibility for other data sources and additional configurations like rate limiting.

## Setting Up Team LBAC Rules for a Loki Data Source in Grafana Cloud

### Prerequisites

### Required permissions
Ensure you have administrative access to Grafana Cloud (GCom) and the necessary permissions to configure data sources and access policies. You should also have access to the teams you want to configure rules for.

TODO: add required permissions

### Steps to Configure Team LBAC Rules
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
