---
title: Planning IAM integration strategy
menuTitle: IAM integration
description: Considerations and planification before setting up Grafana for the first time.
aliases:
  - /docs/mimir/latest/old-architecture/
  - docs/sources/auth/planning/
weight: 200
keywords:
  - IdP
  - IAM
  - Auth
---

# Planning your IAM integration strategy

This topic describes the decisions you should make when using an Identity and Access Management (IAM) provider to manage access to Grafana. IAM ensures that users have secure access to sensitive data and [Grafana resources], simplifying user management and authentication.

## Benefits of integrating with an IAM provider

Integrating with an IAM provider provides the following benefits:

- **User management**: By providing Grafana access to your current user database, you eliminate the overhead of replicating user information and instead have centralized user management for users' roles and permissions to Grafana resources.

- **Security**: IAM solutions provide advanced security features such as MFA, RBCA, and audit trails, which can help to improve the security of your Grafana installation.

- **SSO**: Properly setting up Grafana with your current IAM solution enables users to access Grafana with the same credentials they use for other applications.

- **Scalability**: Adding, updating, or removing users from your user database is immediately reflected in Grafana.

In order to plan an integration with Grafana, assess your organization's current needs, requirements and any existing IAM solutions being used. This should include which set of roles and permissions will be match to each type of user and which groups of users share the same set of permissions and access to shared resources.

After considering needs, chosen IAM solution and taking into consideration the security requirements, the last step is to test it out thoroughly before deploying it to a production environment.

## Internal vs external users

As a first step, determine where your Grafana users are located. Are the users located within your organization, or are they outside your organization?

If the users are within your organization, Grafana might be able to integrate with those users through an identify provider.

If the users are outside your organization, you must provide anonymous access to Grafana, which is not enabled by default.

For information about enabling anonymous access, refer to the [documentation](../../setup-grafana/configure-security/configure-authentication/_index.md#anonymous-authentication)

## Ways to organize users

Organize users in subgroups that are sensible to the organization. These are some examples:

- **Security**: Different groups of users or customers should only have access to their intended resources.
- **Simplicity**: Reduce the scope of dashboards and resources available.
- **Cost attribution**: Track and bill costs to their customers, departments, or divisions.
- **Customization**: Each group of users could have a personalized experience like different dashboards or theme colours.

### Users in Grafana Teams

You can organize users into [Teams] and assign them roles and permissions reflecting the current organization. For example, instead of assigning five users access to the same dashboard, you can create a team that consists of those users and assign dashboard permissions to the team. A user can belong to multiple teams.

A user can be a Member or an Administrator for a given team. Members of a team inherit permissions from the team, but they cannot edit the team itself. Team Administrators can add members to a team and update its settings, such as the team name, team members' team roles, UI preferences, and the default dashboard to be displayed upon login for the team members.

Teams are a perfect solution for working with a small subset of users. Teams can share resources with other teams.

### Users in Grafana Organizations

[Grafana Organizations] isolate users from dashboards and data sources by having multiple organizations under a single instance of Grafana. This means users under different organizations won't share any resources such as dashboards, folders, and data sources.

By default, organizations provide a measure of isolation within Grafana. They can be used to present different user experiences, which gives the appearance that there are multiple instances of Grafana within a single instance. However, because they lack the scalability of [Folders], we do not recommend using organizations as a way to group users.

### Choosing between teams and organizations

[Grafana teams] and Grafana organizations serve similar purposes in the Grafana platform. While both are designed to help manage and control access to resources, teams provide a more focused approach for smaller groups or projects. Teams also enable collaboration and shared ownership of resources among members, making it simple to manage access and control who has access to which resources.

In contrast, organizations provide a higher level of management for multiple teams and resources. They are designed for larger enterprises or organizations with a complex setup or multiple or different business models.

## Access to external systems

Consider the need for machine-to-machine [M2M] communications. If a system needs to interact with Grafana, ensure it has proper access.

Consider the following scenarios:

**IoT devices monitoring**: Sensors and actuators might feed information into Grafana in an automatic way. Consider the security implications of a shared security access for all the devices or an individual access to each of them.

**Network monitoring**: Having distributed systems architecture performance reported back to Grafana can provide insight into bottlenecks and trigger alerts that should be resolved promptly.

**Stocks**: Keeping track of the stocks changes overtime can be automated with by an automated agent feeding information into Grafana. Thus, keeping track of the changes overtime.

These are just a few examples of how Grafana can be used in M2M scenarios. The platform is highly flexible and can be used in a variety of other M2M applications, making it a powerful tool for organizations looking to gain insights into their systems and devices.

### Service accounts

You can use a service account to run automated workloads in Grafana, such as dashboard provisioning, configuration, or report generation. Create service accounts and service accounts tokens to authenticate applications, such as Terraform, with the Grafana API.

> **Note:** Service accounts will eventually replace [API keys]({{< relref "../api-keys/" >}}) as the primary way to authenticate applications that interact with Grafana.

A common use case for creating a service account is to perform operations on automated or triggered tasks. You can use service accounts to:

- Schedule reports for specific dashboards to be delivered on a daily/weekly/monthly basis
- Define alerts in your system to be used in Grafana
- Set up an external SAML authentication provider
- Interact with Grafana without signing in as a user

In [Grafana Enterprise]({{< relref "../../introduction/grafana-enterprise/" >}}), you can also use service accounts in combination with [role-based access control]({{< relref "../roles-and-permissions/access-control/" >}}) to grant very specific permissions to applications that interact with Grafana.

> **Note:** Service accounts can only act in the organization they are created for. If you have the same task that is needed for multiple organizations, we recommend creating service accounts in each organization.

{{< vimeo 742056367 >}}
<br>

## Service account tokens

A service account token is a generated random string that acts as an alternative to a password when authenticating with Grafana's HTTP API.

When you create a service account, you can associate one or more access tokens with it. You can use service access tokens the same way as API Keys, for example to access Grafana HTTP API programmatically.

You can create multiple tokens for the same service account. You might want to do this if:

- multiple applications use the same permissions, but you would like to audit or manage their actions separately.
- you need to rotate or replace a compromised token.

Service account access tokens inherit permissions from the service account.

### 🚧 Personal access tokens

### 🚧 API keys

## How to work with roles?

Roles are used to regulate which resources each user or service account can access within Grafana and what actions they're allowed to carry out.

Roles can be set manually through the UI or APIs, provisioned through Terraform or automatically synced through an external IAM provider.

### What are roles?

Grafana has a set of basic roles - organization administrator, editor and viewer - that determine user's permissions within an organization, such as access to edit data sources or create teams.
Each user must have one of these roles assigned to them in each organization that they are a member of.

Furthermore, Grafana has a server administrator basic role which allows accessing and interacting with instance wide resources, such as organizations, users and server-wide settings.
This role is only available to users of self-hosted Grafana instances. It is a powerful role and is meant for Grafana instance administrators.

### What are permissions?

Each role consists of a set of permissions. Permissions determine the tasks a user can perform in the system.
For example, the **Admin** role includes permissions for an administrator to create and delete users.

Grafana supports setting granular permissions for dashboards and folders to determine which users and teams are allowed to view, edit and administer them.
For example, you might want a certain viewer to be able to edit a dashboard. While that user can see all dashboards, you can grant them access to update only one of them.

In [Grafana Enterprise]({{< relref "../../introduction/grafana-enterprise/" >}}), you can also grant granular permissions for data sources to control who can query and edit them.

Dashboard, folder and data source permissions can be set through the UI or APIs or provisioned through Terraform.

### Role-based access control

> **Note:** Available in [Grafana Enterprise]({{< relref "../../../introduction/grafana-enterprise/" >}}) and [Grafana Cloud Advanced](/docs/grafana-cloud).

If you find basic organization and server administrator roles are too restrictive, you might want to consider using RBAC features.
RBAC provides you a fully flexible way of granting, changing, and revoking user read and write access to Grafana resources, such as users, data sources and reports.

RBAC comes with a set of pre-defined roles, such as data source writer, which allows updating, reading, or querying all data sources.
You can assign these roles to users, teams and service accounts.

Moreover, RBAC allows you to create your own custom roles and edit permissions granted by Grafana's basic roles.

## 🚧 Will I need synchronization?

### 🚧 Team sync

### 🚧 Organization sync
