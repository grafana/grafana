---
title: Plan your IAM integration strategy
menuTitle: Plan your IAM integration strategy
description: Learn how to plan your identity and access management strategy before setting up Grafana.
weight: 100
keywords:
  - IdP
  - IAM
  - Auth
  - Grafana
---

# Plan your IAM integration strategy

This section describes the decisions you should make when using an Identity and Access Management (IAM) provider to manage access to Grafana. IAM ensures that users have secure access to sensitive data and [other resources](../../../administration/data-source-management/), simplifying user management and authentication.

## Benefits of integrating with an IAM provider

Integrating with an IAM provider provides the following benefits:

- **User management**: By providing Grafana access to your current user management system, you eliminate the overhead of replicating user information and instead have centralized user management for users' roles and permissions to Grafana resources.

- **Security**: Many IAM solutions provide advanced security features such as multi-factor authentication, RBAC, and audit trails, which can help to improve the security of your Grafana installation.

- **SSO**: Properly setting up Grafana with your current IAM solution enables users to access Grafana with the same credentials they use for other applications.

- **Scalability**: User additions and updates in your user database are immediately reflected in Grafana.

In order to plan an integration with Grafana, assess your organization's current needs, requirements, and any existing IAM solutions being used. This includes thinking about how roles and permissions will be mapped to users in Grafana and how users can be grouped to access shared resources.

## Internal vs external users

As a first step, determine how you want to manage users who will access Grafana.

Do you already use an identity provider to manage users? If so, Grafana might be able to integrate with your identity provider through one of our IdP integrations.
Refer to [Configure authentication documentation](../configure-authentication/) for the list of supported providers.

If you are not interested in setting up an external identity provider, but still want to limit access to your Grafana instance, consider using Grafana's basic authentication.

Finally, if you want your Grafana instance to be accessible to everyone, you can enable anonymous access to Grafana.
For information, refer to the [anonymous authentication documentation](../configure-authentication/#anonymous-authentication).

## Ways to organize users

Organize users in subgroups that are sensible to the organization. For example:

- **Security**: Different groups of users or customers should only have access to their intended resources.
- **Simplicity**: Reduce the scope of dashboards and resources available.
- **Cost attribution**: Track and bill costs to individual customers, departments, or divisions.
- **Customization**: Each group of users could have a personalized experience like different dashboards or theme colors.

### Users in Grafana teams

You can organize users into [teams](../../../administration/team-management/) and assign them roles and permissions reflecting the current organization. For example, instead of assigning five users access to the same dashboard, you can create a team of those users and assign dashboard permissions to the team.

A user can belong to multiple teams and be a member or an administrator for a given team. Team members inherit permissions from the team but cannot edit the team itself. Team administrators can add members to a team and update its settings, such as the team name, team members, roles assigned, and UI preferences.

Teams are a perfect solution for working with a subset of users. Teams can share resources with other teams.

### Users in Grafana organizations

[Grafana organizations](../../../administration/organization-management/) allow complete isolation of resources, such as dashboards and data sources. Users can be members of one or several organizations, and they can only access resources from an organization they belong to.

Having multiple organizations in a single instance of Grafana lets you manage your users in one place while completely separating resources.

Organizations provide a higher measure of isolation within Grafana than teams do and can be helpful in certain scenarios. However, because organizations lack the scalability and flexibility of teams and [folders](../../../dashboards/manage-dashboards/#create-a-dashboard-folder), we do not recommend using them as the default way to group users and resources.

Note that Grafana Cloud does not support having more than 1 organizations per instance.

### Choosing between teams and organizations

[Grafana teams](../../../administration/team-management/) and Grafana organizations serve similar purposes in the Grafana platform. Both are designed to help group users and manage and control access to resources.

Teams provide more flexibility, as resources can be accessible by multiple teams, and team creation and management are simple.

In contrast, organizations provide more isolation than teams, as resources cannot be shared between organizations.
They are more difficult to manage than teams, as you must create and update resources for each organization individually.
Organizations cater to bigger companies or users with intricate access needs, necessitating complete resource segregation.

## Access to external systems

Consider the need for machine-to-machine [M2M](https://en.wikipedia.org/wiki/Machine_to_machine) communications. If a system needs to interact with Grafana, ensure it has proper access.

Consider the following scenarios:

**Schedule reports**: Generate reports periodically from Grafana through the reporting API and have them delivered to different communications channels like email, instant messaging, or keep them in a shared storage.

**Define alerts**: Define alert rules to be triggered when a specific condition is met. Route alert notifications to different teams according to your organization's needs.

**Provisioning file**: Provisioning files can be used to automate the creation of dashboards, data sources, and other resources.

These are just a few examples of how Grafana can be used in M2M scenarios. The platform is highly flexible and can be used in various M2M applications, making it a powerful tool for organizations seeking insights into their systems and devices.

### Service accounts

You can use a service account to run automated workloads in Grafana, such as dashboard provisioning, configuration, or report generation. Create service accounts and service accounts tokens to authenticate applications, such as Terraform, with the Grafana API.

{{< admonition type="note" >}}
Service accounts will eventually replace [API keys](/docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/migrate-api-keys/) as the primary way to authenticate applications that interact with Grafana.
{{< /admonition >}}

A common use case for creating a service account is to perform operations on automated or triggered tasks. You can use service accounts to:

- Schedule reports for specific dashboards to be delivered on a daily/weekly/monthly basis
- Define alerts in your system to be used in Grafana
- Set up an external SAML authentication provider
- Interact with Grafana without signing in as a user

In [Grafana Enterprise](../../../introduction/grafana-enterprise/), you can also use service accounts in combination with [role-based access control](../../../administration/roles-and-permissions/access-control/) to grant very specific permissions to applications that interact with Grafana.

{{< admonition type="note" >}}
Service accounts can only act in the organization they are created for. We recommend creating service accounts in each organization if you have the same task needed for multiple organizations.
{{< /admonition >}}

The following video shows how to migrate from API keys to service accounts.
{{< vimeo 742056367 >}}
<br>

#### Service account tokens

To authenticate with Grafana's HTTP API, a randomly generated string known as a service account token can be used as an alternative to a password.

When a service account is created, it can be linked to multiple access tokens. These service access tokens can be utilized in the same manner as API keys, providing a means to programmatically access Grafana HTTP API.

You can create multiple tokens for the same service account. You might want to do this if:

- Multiple applications use the same permissions, but you want to audit or manage their actions separately.
- You need to rotate or replace a compromised token.

{{< admonition type="note" >}}
In Grafana's audit logs it will still show up as the same service account.
{{< /admonition >}}

Service account access tokens inherit permissions from the service account.

### API keys

{{< admonition type="note" >}}
Grafana recommends using service accounts instead of API keys. API keys will be deprecated in the near future. For more information, refer to [Grafana service accounts](./#service-accounts).
{{< /admonition >}}

You can use Grafana API keys to interact with data sources via HTTP APIs.

## How to work with roles?

Grafana roles control the access of users and service accounts to specific resources and determine their authorized actions.

You can assign roles through the user interface or APIs, establish them through Terraform, or synchronize them automatically via an external IAM provider.

### What are roles?

Within an organization, Grafana has established three primary [organization roles](../../../administration/roles-and-permissions/#organization-roles) - organization administrator, editor, and viewer - which dictate the user's level of access and permissions, including the ability to edit data sources or create teams. Grafana also has an empty role that you can start with and to which you can gradually add custom permissions.
To be a member of any organization, every user must be assigned a role.

In addition, Grafana provides a server administrator role that grants access to and enables interaction with resources that affect the entire instance, including organizations, users, and server-wide settings.
This particular role can only be accessed by users of self-hosted Grafana instances. It is a significant role intended for the administrators of the Grafana instance.

### What are permissions?

Each role consists of a set of [permissions](../../../administration/roles-and-permissions/#dashboard-permissions) that determine the tasks a user can perform in the system.
For example, the **Admin** role includes permissions that let an administrator create and delete users.

Grafana allows for precise permission settings on both dashboards and folders, giving you the ability to control which users and teams can view, edit, and administer them.
For example, you might want a certain viewer to be able to edit a dashboard. While that user can see all dashboards, you can grant them access to update only one of them.

In [Grafana Enterprise](../../../introduction/grafana-enterprise/), you can also grant granular permissions for data sources to control who can query and edit them.

Dashboard, folder, and data source permissions can be set through the UI or APIs or provisioned through Terraform.

### Role-based access control

{{< admonition type="note" >}}
Available in [Grafana Enterprise](../../../introduction/grafana-enterprise/) and [Grafana Cloud](/docs/grafana-cloud/).
{{< /admonition >}}

If you think that the basic organization and server administrator roles are too limiting, it might be beneficial to employ [role-based access control (RBAC)](../../../administration/roles-and-permissions/access-control/).
RBAC is a flexible approach to managing user access to Grafana resources, including users, data sources, and reports. It enables easy granting, changing, and revoking of read and write access for users.

RBAC comes with pre-defined roles, such as data source writer, which allows updating, reading, or querying all data sources.
You can assign these roles to users, teams, and service accounts.

In addition, RBAC empowers you to generate personalized roles and modify permissions authorized by the standard Grafana roles.

## User synchronization between Grafana and identity providers

When connecting Grafana to an identity provider, it's important to think beyond just the initial authentication setup. You should also think about the maintenance of user bases and roles. Using Grafana's team and role synchronization features ensures that updates you make to a user in your identity provider will be reflected in their role assignment and team memberships in Grafana.

### Team sync

Team sync is a feature that allows you to synchronize teams or groups from your authentication provider with teams in Grafana. This means that users of specific teams or groups in LDAP, OAuth, or SAML will be automatically added or removed as members of corresponding teams in Grafana. Whenever a user logs in, Grafana will check for any changes in the teams or groups of the authentication provider and update the user's teams in Grafana accordingly. This makes it easy to manage user permissions across multiple systems.

{{< admonition type="note" >}}
Available in [Grafana Enterprise](../../../introduction/grafana-enterprise/) and [Grafana Cloud Advanced](/docs/grafana-cloud/).
{{< /admonition >}}

{{< admonition type="note" >}}
Team synchronization occurs only when a user logs in. However, if you are using LDAP, it is possible to enable active background synchronization. This allows for the continuous synchronization of teams.
{{< /admonition >}}

### Role Sync

Grafana can synchronize basic roles from your authentication provider by mapping attributes from the identity provider to the user role in Grafana. This means that users with specific attributes, like role, team, or group membership in LDAP, OAuth, or SAML, will be automatically assigned the corresponding role in Grafana. Whenever a user logs in, Grafana will check for any changes in the user information retrieved from the authentication provider and update the user's role in Grafana accordingly.

### Organization sync

Organization sync is the process of binding all the users from an organization in Grafana. This delegates the role of managing users to the identity provider. This way, there's no need to manage user access from Grafana because the identity provider will be queried whenever a new user tries to log in.

With organization sync, users from identity provider groups can be assigned to corresponding Grafana organizations. This functionality is similar to role sync but with the added benefit of specifying the organization that a user belongs to for a particular identity provider group. Please note that this feature is only available for self-hosted Grafana instances, as Cloud Grafana instances have a single organization limit.

{{< admonition type="note" >}}
Organization sync is currently only supported for SAML and LDAP.
{{< /admonition >}}

{{< admonition type="note" >}}
You don't need to invite users through Grafana when syncing with Organization sync.
{{< /admonition >}}

{{< admonition type="note" >}}
Currently, only basic roles can be mapped via Organization sync.
{{< /admonition >}}
