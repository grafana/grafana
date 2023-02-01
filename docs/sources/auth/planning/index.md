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

## Where are my users?

The first thing to consider is who are my users? Are the user exclusively within my organization or will they be outside of my organization?

If the users are within my organization, this means that Grafana might be able to integrate with those users by providing connection with to the corresponding Identity Provider.

If the users are outside of my organization, this means that Grafana needs to provide anonymous access, which is not enabled by default.

### Users in teams

It makes sense to organize users within teams in order to assign the same roles and permissions rather than invidually. For example, instead of assigning five users access to the same dashboard, you can create a team that consists of those users and assign dashboard permissions to the team. A user can belong to multiple teams.

A user can be a Member or an Administrator for a given team. Members of a team inherit permissions from the team, but they cannot edit the team itself. Team Administrators can add members to a team and update its settings, such as the team name, team member’s team roles, UI preferences, and the default dashbord to be displayed upon login for the team members.

### 🚧 Users in organizations

### 🚧 Choosing between teams and organizations

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
