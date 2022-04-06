---
title: About service accounts
menuTitle: About service accounts
description: 'This page contains detailed information about service accounts in Grafana'
weight: 30
---

# About service accounts in Grafana

A service account can be used to run automated or compute workloads. Applications use service account tokens to authorize themselves as a service account.

> **Note:** Service accounts are available in Grafana 8.5+ as a beta feature, to enable service accounts refer to [Enable service accounts]({{< relref "./enable-service-accounts.md#">}}) section.

A common use case for creating a service account is to perform operations on automated or triggered tasks. You can use service accounts to:

- Schedule reports for specific dashboards to be delivered on a daily/weekly/monthly basis
- Define alerts in your system to be used in Grafana
- Set up an external authentication provider to manage users and permissions across an organization
- Establish machine-to-machine communication
- Interact with Grafana without logging in as a user

You can also use service accounts in combination with fine-grained access control to grant users and teams specific scopes.

You can associate a service account with multiple tokens. For example:

- each team member can generate their own token
-

We recommend starting off by creating one service account per use case.

> **Note:** Service accounts can only act in the organization they are created for. If you have the same task that is needed for multiple organizations, we recommend creating service accounts in each organization.

---

### Service accounts benefits

When creating a token for a service account, we call them service account token; which are essentially a API key. The main difference to API keys is that permission is set on top of the API key when creating API keys, where as a service account token gets their permission from the service account.

The added benefits of service accounts to API keys are:

- Service accounts act like users in Grafana and can be enabled/disabled, granted specific permissions, and remain active until deleted or disabled whereas API keys only live until their expiry date.
- Service accounts can be associated with multiple tokens.
- Unlike API keys, service account tokens are not associated with a specific user, which means that applications can be authenticated even if a Grafana user is deleted.
- You can grant granular permissions to service accounts by leveraging FGAC, API keys are not a part of FGAC. For more information about permissions, refer to [About users and permissions]({{< relref "../manage-users-and-permissions/about-users-and-permissions.md#">}}).
