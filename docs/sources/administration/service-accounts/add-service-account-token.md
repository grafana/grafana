---
title: 'Add a token to a service account in Grafana'
menuTitle: 'Add a token to a service account'
description: 'This topic shows you how to add a token to a service account'
weight: 60
---

# Add a token to a service account in Grafana

A service account token is a randomly generated string that external system use to authenticate into Grafana, and include specific permissions to interact with the Grafana HTTP APIs.
For more information about service accounts, refer to [About service accounts in Grafana]({{< relref "./about-service-accounts.md">}}).

You can create a service account token using the Grafana UI or via the API. For more information about creating a service account token via the API, refer to [HTTP API Create service account token]({{< relref "../../http_api/serviceaccount.md#create-service-account-tokens">}}).

## Before you begin

- Ensure you have added the `service-accounts` feature toggle to Grafana. For more information about adding the `service-accounts` feature toggle, refer to [Enable service accounts]({{< relref "./enable-service-accounts.md#">}}).
- Ensure you have permission to create and edit service accounts. For more information about user roles, refer to [About users and permissions]({{< relref "../manage-users-and-permissions/about-users-and-permissions.md#">}}).
- [Create a service account in Grafana]({{< relref "./create-service-account.md#">}}).

**To add a token to a service account:**

1. Sign in to Grafana and hover your cursor over the organization icon in the sidebar.
1. Click **Service accounts**.
1. Click the service account to which you want to add a token.
1. Click **Add token**.
1. Enter a name for the token.
1. (recommended) Enter an expiry date and expiry date for the token or leave it on no expiry date option.
   - The expiry date specifies how long you want the key to be valid.
   - If you are unsure of an expiration date, we recommend that you set the token to expire after a short time, such as a few hours or less. This limits the risk associated with a token that is valid for a long time.
1. Click **Generate service account token**.
