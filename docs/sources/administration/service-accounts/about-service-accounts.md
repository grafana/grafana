---
title: About service accounts
menuTitle: About service accounts
aliases: [docs/sources/manage-service-accounts/_index.md, 
docs/sources/administration/service-accounts/about-service-accounts.md,
docs/sources/administration/service-accounts/create-service-accounts.md]
description: "This page contains detailed information about service accounts in Grafana"
weight: 30
---

# About service accounts in Grafana

A service account is a regular user account used to run automated or compute workloads which are intended for programmatic use either internally for a Grafana feature or to communicate outside of the Grafana environment. Applications use service account tokens to authorize themselves as a service account.

A common use case for creating a service account is to perform operations on automated or triggered tasks. You can use service accounts to:

- Schedule reports for specific dashboards to be delivered on a daily/weekly/monthly basis
- Define alerts in your system to be used in Grafana
- Set up an external authentication provider to manage users and permissions across an organization
- Establish machine-to-machine communication

You can also use service accounts in combination with fine-grained access control to grant users and teams specific scopes.

A service account can be associated with multiple api keys. As a result, we recommend starting off by creating one service account per use case.

> **Note:** Service accounts act on an organization level, if you have the same task that is needed for multiple organizations, we recommend provisioning service accounts for each organization.

---

## Grafana service account vs API key

We have created service accounts for improved access control of programmatic access to Grafana. A service account token is a token that is used to authenticate a service account to Grafana and is very similar to an API key.

We recommend that you use service accounts instead of using API keys.

### Service accounts benefits

When creating a token for a service account, we call them service account token; which are essentially a API key. The main difference to API keys is that permission is set on top of the API key when creating API keys, where as a service account token gets their permission from the service account.

The added benefits of service accounts to API keys are:

- Service accounts act like users in Grafana and can be enabled, disabled, and granted permissions. You cannot grant permissions to API keys.
- Service accounts can be associated with multiple api keys.
- Unlike API keys, service account tokens are not associated with a specific user, which means that applications can be authenticated even if a Grafana user is deleted.
- You can grant granular permissions to service accounts. For more information about permissions, refer to [About users and permissions]({{< relref "../manage-users-and-permissions/about-users-and-permissions.md#">}}).
- Eventually API keys will be deprecated
