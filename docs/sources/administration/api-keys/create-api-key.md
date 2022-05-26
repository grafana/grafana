---
aliases:
  - /docs/grafana/latest/administration/api-keys/create-api-key/
description: How to create an API key in Grafana
keywords:
  - API keys
  - Service accounts
menuTitle: Create an API key
title: Create an API key in Grafana
weight: 50
---

# Create an API key in Grafana

Create an API key when you want to manage your computed workload with a user.

For more information about API keys, refer to [About API keys in Grafana]({{< relref "./about-api-keys.md" >}}).

This topic shows you how to create an API key using the Grafana UI. You can also create an API key using the Grafana HTTP API. For more information about creating API keys via the API, refer to [Create API key via API]({{< relref "../../developers/http_api/create-api-tokens-for-org.md#how-to-create-a-new-organization-and-an-api-token" >}}).

## Before you begin:

- Ensure you have permission to create and edit API keys. For more information about permissions, refer to [About users and permissions]({{< relref "../manage-users-and-permissions/about-users-and-permissions.md#" >}}).

**To create an API key:**

1. Sign in to Grafana, hover your cursor over **Configuration** (the gear icon), and click **API Keys**.
1. Click **New API key**.
1. Enter a unique name for the key.
1. In the **Role** field, select one of the following access levels you want to assign to the key.
   - **Admin**: Enables a user to use APIs at the broadest, most powerful administrative level.
   - **Editor** or **Viewer** to limit the key's users to those levels of power.
1. In the **Time to live** field, specify how long you want the key to be valid.
   - The maximum length of time is 30 days (one month). You enter a number and a letter. Valid letters include `s` for seconds,`m` for minutes, `h` for hours, `d `for days, `w` for weeks, and `M `for month. For example, `12h` is 12 hours and `1M` is 1 month (30 days).
   - If you are unsure about how long an API key should be valid, we recommend that you choose a short duration, such as a few hours. This approach limits the risk of having API keys that are valid for a long time.
1. Click **Add**.
