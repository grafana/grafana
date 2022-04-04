---
title: Create a API key in Grafana
menuTitle: Create a API key
aliases: [docs/sources/administration/service-accounts/create-api-key.md]
description: 'How to create a API key in Grafana'
weight: 50
keywords:
  - API keys
  - Service accounts
---

# Create a API key in Grafana

You can create a API key in the API keys tab of the organization. To manage your computed workload with a user that is not tied to a user specifically.

For more information about API keys refer to [About API keys in Grafana]({{< relref "./about-api-keys.md">}}).

For more information about creating API keys via the API, refer to [Create API key via API]({{< relref "../../http_api/create-api-tokens-for-org.md#how-to-create-a-new-organization-and-an-api-token">}}).

Before you begin:

**To create a API key:**

- Ensure you have permission to create and edit API keys, for more information refer to [About users and permissions]({{< relref "../manage-users-and-permissions/about-users-and-permissions.md#">}})

1. In the Grafana console side menu, pause on the Configuration (gear) icon, then choose API Keys.
2. Choose **New API key**.
3. Enter a unique name for the key.
4. For Role, select the access level that the key is to be granted.

- Select Admin to allow a user with this key to use APIs at the broadest, most powerful administrative level. Select Editor or Viewer to limit the key's users to those levels of power.

1. For Time to live, specify how long you want the key to be valid. The maximum is 30 days (one month). You enter a number and a letter. The valid letters are s for seconds, m for minutes, h for hours, d for days, w for weeks, and M for month. For example, 12h is 12 hours and 1M is 1 month (30 days).

- If you are unsure of this step, we recommend that you set the key's time to live for a shorter time, such as a few hours or less. This creates much less risk than having API keys that are valid for a long time.

1. Choose Add.
