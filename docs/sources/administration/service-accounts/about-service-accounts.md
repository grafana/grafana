---
description: This page contains detailed information about service accounts in Grafana
menuTitle: About service accounts
title: About service accounts
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

You can also use service accounts in combination with fine-grained access control to grant users specific scopes.

You can associate a service account with multiple tokens. This is because a service account:

- can be used by multiple team members and therefore can generate their own token each
- can be used across multiple tenants and each tenant can have its own token

We recommend the you begin by creating one service account for each use case.

> **Note:** Service accounts can only act in the organization they are created for. If you have the same task that is needed for multiple organizations, we recommend creating service accounts in each organization.

---

## Service account tokens

A service account token is a generated random string that are an alternative to using passwords for authentication with Grafana, to interact with the Grafana HTTP APIs.

When you create a service account, you can associate one or more access tokens with it. You can use service access tokens the same way as API Keys, for example to access Grafana HTTP API programmatically.

Service account access tokens inherit permissions from service account directly.

### Service accounts benefits

The added benefits of service accounts to API keys include:

- Service accounts resemble Grafana users and can be enabled/disabled, granted specific permissions, and remain active until they are deleted or disabled. API keys are only valid until their expiry date.
- Service accounts can be associated with multiple tokens.
- Unlike API keys, service account tokens are not associated with a specific user, which means that applications can be authenticated even if a Grafana user is deleted.
- You can grant granular permissions to service accounts by leveraging [fine-grained access control]({{< relref "../../enterprise/access-control">}}). For more information about permissions, refer to [About users and permissions]({{< relref "../manage-users-and-permissions/about-users-and-permissions.md#">}}).
