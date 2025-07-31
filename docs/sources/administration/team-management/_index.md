---
aliases:
  - ../manage-users/add-or-remove-user-from-team/
  - ../manage-users/create-or-remove-team/
  - ../manage-users/manage-teams/
  - manage-users-and-permissions/manage-teams/
description: This document introduces Grafana Teams and Teams concepts.
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

Teams are useful in a wide variety of scenarios, such as when onboarding new colleagues or needing access to reports on secure financial data. When you add a user to a team, they get access to all resources assigned to that team.

## Teams concepts

A Grafana Team is a group of users within an organization that have common permissions, including access to dashboards and data sources, and those permissions apply to **all members** of that team. For example, instead of assigning six users access to the same dashboard, you can create a team that consists of those users and assign dashboard permissions to the team. A user can belong to multiple teams.

A Team grants permissions to a wide variety of resources including:

- dashboards
- data sources
- folders
- alerts
- reports
- cloud access policies
- annotations
- playlists

{{< admonition type="note" >}}
All members of a Grafana Team have the same exact permissions. A single Team can't have members with different access levels to resources shared within that Team.

Additionally, when a user belongs to multiple Teams that have different permission levels for the same resource, the user receives the highest (most permissive) access level from any of their Teams. For example, if a user belongs to two Teams, one with Viewer access and another with Editor access to a folder, the user will have Editor access to that folder.
{{< /admonition >}}

A user can be a `Member` or an `Administrator` for a given Team. `Members` of a Team inherit permissions from the team, but they don't have team administrator privileges, and can't edit the team itself. Team `Administrators` can add members to a team and update its settings, such as the team name, team member’s team roles, UI preferences, and home dashboard.

There are two types of Teams, `isolated` or `collaborative`. Isolated teams can only see their own resources. They can't see other team’s resources like dashboards, data, or alerts. Collaborative teams have access to other team’s resources.

For information about how to optimize Teams, refer to [How to best organize your teams and resources in Grafana](https://grafana.com/blog/2022/03/14/how-to-best-organize-your-teams-and-resources-in-grafana/).
