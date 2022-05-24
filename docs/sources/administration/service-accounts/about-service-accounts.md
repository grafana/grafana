---
aliases:
  - /docs/grafana/latest/administration/service-accounts/about-service-accounts/
description: This page contains detailed information about service accounts in Grafana
menuTitle: About service accounts
title: About service accounts
weight: 30
---

# About service accounts in Grafana

A service account can be used to run automated workloads in Grafana, like dashboard provisioning, configuration, or report generation. Create service accounts and tokens to authenticate applications like Terraform with the Grafana API.

> **Note:** Service accounts are available in Grafana 8.5+ as a beta feature. To enable service accounts, refer to [Enable service accounts]({{< relref "./enable-service-accounts.md#" >}}) section. Service accounts will eventually replace [API keys]({{< relref "../api-keys/_index.md" >}}) as the primary way to authenticate applications that interact with Grafana.

A common use case for creating a service account is to perform operations on automated or triggered tasks. You can use service accounts to:

- Schedule reports for specific dashboards to be delivered on a daily/weekly/monthly basis
- Define alerts in your system to be used in Grafana
- Set up an external SAML authentication provider
- Interact with Grafana without signing in as a user

In [Grafana Enterprise]({{< relref "../../enterprise/_index.md" >}}), you can also use service accounts in combination with [role-based access control]({{< relref "../../enterprise/access-control/about-rbac.md" >}}) to grant very specific permissions to applications that interact with Grafana.

> **Note:** Service accounts can only act in the organization they are created for. If you have the same task that is needed for multiple organizations, we recommend creating service accounts in each organization.

---

## Service account tokens

A service account token is a generated random string that acts as an alternative to a password when authenticating with Grafana's HTTP API.

When you create a service account, you can associate one or more access tokens with it. You can use service access tokens the same way as API Keys, for example to access Grafana HTTP API programmatically.

You can create multiple tokens for the same service account. You might want to do this if:

- multiple applications use the same permissions, but you would like to audit or manage their actions separately.
- you need to rotate or replace a compromised token.

Service account access tokens inherit permissions from the service account.

### Service accounts benefits

The added benefits of service accounts to API keys include:

- Service accounts resemble Grafana users and can be enabled/disabled, granted specific permissions, and remain active until they are deleted or disabled. API keys are only valid until their expiry date.
- Service accounts can be associated with multiple tokens.
- Unlike API keys, service account tokens are not associated with a specific user, which means that applications can be authenticated even if a Grafana user is deleted.
- You can grant granular permissions to service accounts by leveraging [fine-grained access control]({{< relref "../../enterprise/access-control" >}}). For more information about permissions, refer to [About users and permissions]({{< relref "../manage-users-and-permissions/about-users-and-permissions.md#" >}}).
