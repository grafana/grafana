---
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/configure-rbac/access-roles
description: Manage access using roles
keywords:
  - grafana
  - alerting
  - set up
  - configure
  - RBAC
  - role access
labels:
  products:
    - enterprise
    - cloud
title: Manage access using roles
weight: 100
---

# Manage access using roles

In Grafana Enterprise and Grafana Cloud, there are Basic, Fixed, and Custom roles.

## Basic roles

There are four basic roles: **Admin**, **Editor**, **Viewer**, and **No basic role**. Each basic role contains a number of fixed roles.

The **No basic role** allows you to further customize access by assigning fixed roles to users, which you can also modify. You can also create and assign custom roles to a user with **No basic role**.

Details of the basic roles and the access they provide for Grafana Alerting are below.

## Fixed roles

A fixed role is a group of multiple permissions.

Fixed roles provide users more granular access to create, view, and update Alerting resources than you would have with basic roles alone.

Details of the fixed roles and the access they provide for Grafana Alerting are below.

## Create custom roles

Create custom roles of your own to manage permissions. Custom roles contain unique combinations of permissions, actions and scopes. Create a custom role when basic roles and fixed roles do not meet your permissions requirements.

For more information on creating custom roles, refer to [Create custom roles](https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/access-control/manage-rbac-roles/#create-custom-roles).

The following examples give you an idea of how you can combine permissions for Grafana Alerting.

## Assign roles

To assign roles, complete the following steps.

1. Navigate to Administration > Users and access > Users, Teams, or Service Accounts.
1. Search for the user, team or service account you want to add a role for.
1. Select the role you want to assign.
