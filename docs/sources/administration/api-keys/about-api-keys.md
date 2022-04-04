---
title: About API keys in Grafana
menuTitle: About API keys
aliases: [docs/sources/administration/api-keys/about-api-keys.md]
description: 'This contains detailed information about API keys in Grafana'
weight: 30
---

# About API keys in Grafana

An API key is a encrypted string that identifies as a specific role to your Grafana instance when talking to apis. You can more easily use Grafana HTTP APIs by leveraging API keys.

To create an API key, use the following procedure. An API key is valid for a limited time that you specify when you create it, up to 30 days.

When you create an API key, you specify a role for the key. The role determines the level of administrative power that users of the key have. For more information about creating API keys, refer to [Create API key]({{< relref "./create-api-key.md#">}}).
