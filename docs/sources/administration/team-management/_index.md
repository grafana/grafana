---
aliases:
  - 
description: Learn more about Grafana Mimir’s microservices-based architecture.
labels:
  products:
    - enterprise
    - oss
    - cloud
keywords:
  - authorization
  - microservices
  - architecture
menuTitle: Grafana Teams
title: Grafana Teams
weight: 100
---

# Grafana Teams

Grafana Teams makes it easy to organize and administer groups of users in your enterprise. Teams allows you to grant permissions to a group of users instead of granting permissions to individual users one at a time.

Teams are useful in a wide variety of scenarios, such as when onboarding new colleagues or needing access to report on secure financial data. When you add a user to a team, they get access to all resources assigned to that team.

## Teams concepts

A Grafana Team is a group of users within an organization that have common permissions, including dashboard and data source, and those permissions apply to **all members** of that team. For example, instead of assigning six users access to the same dashboard, you can create a team that consists of those users and assign dashboard permissions to the team. A user can belong to multiple teams.

{{< admonition type="note" >}}
All members of a Grafana Team have the same exact permissions. A single Team cannot have members with different access levels.
{{< /admonition >}}

A user can be a `Member` or an `Administrator` for a given Team. `Members` of a Team inherit permissions from the team, but they cannot edit the team itself. Team `Administrators` can add members to a team and update its settings, such as the team name, team member’s team roles, UI preferences, and home dashboard.

Teams can either be `isolated` or `collaborative`. Isolated teams can only see their own artifacts. They cannot see other team’s dashboards, data, alerts, etc. Collaborative teams have access to other team’s artifacts. See [Configuring teams}]() for information on setting up collaborative and isolated teams.

A Team includes permissions to the following:

- Dashboards
- Data sources
- Folders
- Alerts
- Reports

{{< admonition type="note" >}}
[Grafana Organizations](https://grafana.com/docs/grafana/latest/administration/organization-management/) do not exist in Grafana Cloud. Grafana Cloud uses the term “organization” to refer to accounts in grafana.com. In Grafana Enterprise and OSS, Teams belong to Grafana Organizations.  
{{< /admonition >}}

