---
title: Planning IAM integration strategy
menuTitle: IAM integration
description: Considerations and .
aliases:
  - /docs/mimir/latest/old-architecture/
  - docs/sources/auth/planning/
weight: 200
keywords:
  - IdP
  - IAM
  - Auth
---

# Planning IAM integration strategy

The following documentation is meant to shed light on the different authorization and authentications strategies available in Grafana. By doing preparation before implementation, the user will be able to decide which integration strategy suits best for their needs.

Identity and Access Management (IAM) is needed to handle secure access to [Grafana resources]. Integrating Grafana with the proper solution is a key step to allow user access to sensitive data and resouces, and to simplify user management and authentication.

## Benefits of having an IAM integration

Consider the following benefits for IAM integration strategy with Grafana.

1. **User management**: By providing Grafana access to your current user database, you eliminate the overhead of replicating any user information and instead have a centrilized user management for user's roles and permissions to Grafana resources.

1. **Better security**: IAM solutions already provide advanced security features such as MFA, RBCA, and audit trails, which can help to improve the security of your Grafana installation.

1. **SSO**: By properly setting up Grafana with your current IAM solution will benefit user experience by accessing the Grafana instance with the same set of credentials as they use for everything else within the organization.

1. **Scalability**: Adding, updating or removing users from your user database will reflect immediately at the Grafana instance.

In order to plan an integration with Grafana, assess your organization's current needs, requirements and any existing IAM solutions being used. This should include which set of roles and permissions will be match to each type of user and which groups of users share the same set of permissions and access to shared resources.

After considering needs, chosen IAM solution and taking into consideration the security requirements, the last step is to test it out thoroughly before deploying it to a production environment.

## Where are my users?

The first thing to consider is who are my users? Are the user exclusively within my organization or will they be outside of my organization?

If the users are within my organization, this means that Grafana might be able to integrate with those users by providing connection with to the corresponding Identity Provider.

If the users are outside of my organization, this means that Grafana needs to provide anonymous access, which is not enabled by default.

### Why do I need to organize the users?

1. **Security**: Different teams and customer should only have access to their intended resources.
1. **Simplicity**: Reduce scope of dashboards and resources available.
1. **Cost attribution**: Track and bill costs to their customers, departments, or divisions.
1. **Customization**: Each team could have a personalized experience like different dashboards or theme colours.

### Users in Grafana Teams

It makes sense to organize users in Teams in order to assign them roles and permissions reflecting the current organization. For example, instead of assigning five users access to the same dashboard, you can create a team that consists of those users and assign dashboard permissions to the team. A user can belong to multiple teams.

A user can be a Member or an Administrator for a given team. Members of a team inherit permissions from the team, but they cannot edit the team itself. Team Administrators can add members to a team and update its settings, such as the team name, team member’s team roles, UI preferences, and the default dashbord to be displayed upon login for the team members.

Teams is a perfect solution to work with a small subset of users. Teams can share resources among other teams.

### Users in Grafana Organizations

[Grafana Organizations] was born as a concept to isolate users from dashboards and datasources by having multiple organizations under a single instance of Grafana. This means that users under different organizations won't share any resources such as dashboards, folders, and datasources.

Grafana Organizations provide a mesure of isolation within Grafana by default. The intention is to present different user experiences, which give the sense of different instances of Grafana within a single instance. However, **we recommend aginast Grafana Organizations** because they lack the scalability of [Folders].

## 🚧 Do I have external systems?

### 🚧 Service Accounts

### 🚧 Personal access tokens

### 🚧 API keys

## 🚧 How to work with roles?

### 🚧 What are permissions?

### 🚧 What are roles?

### 🚧 Grafana roles vs RBAC: Which one is for me?

## 🚧 Will I need synchronization?

### 🚧 Team sync

### 🚧 Organization sync
