---
aliases:
  - ../../enterprise/settings-updates/
description: Settings updates at runtime
keywords:
  - grafana
  - runtime
  - settings
title: Settings updates at runtime
weight: 500
---

# Settings updates at runtime

> **Note:** Available in Grafana Enterprise version 8.0 and later.

By updating settings at runtime, you can update Grafana settings without needing to restart the Grafana server.

Updates that happen at runtime are stored in the database. These updates override [settings from the other sources]({{< relref "../../configure-grafana/" >}}), such as arguments, environment variables, and settings file, etc.

Thus, whenever a particular setting key is deleted at runtime, the value for that key is inherited from the other sources in the reverse order of precedence, which is: command-line arguments, environment variables, and settings file. If none of these sources provide a value, the application's default value will be used.

Currently, **this only supports updates on the `auth.saml` section.**

## Update settings via the API

You can update settings through the [Admin API]({{< relref "../../../developers/http_api/admin/#update-settings" >}}).

When you submit a settings update via API, Grafana verifies if the given settings updates are allowed and valid. If they are, then Grafana stores the settings in the database and reloads
Grafana services with no need to restart the instance.

To update settings via the API, send a `PUT` request to the (`/api/admin/settings`) endpoint. The payload of the request should contain either one or both of the following:

- An `updates` map with a key, and a value per section you want to set.
- A `removals` list with keys per section you want to unset.

For example, if you provide the following `updates`:

```json
{
  "updates": {
    "auth.saml": {
      "enabled": "true",
      "single_logout": "false"
    }
  }
}
```

it would enable SAML and disable single logouts. And, if you provide the following `removals`:

```json
{
  "auth.saml": ["allow_idp_initiated"]
}
```

it would remove the key/value setting identified by `allow_idp_initiated` within the `auth.saml`.
So, the SAML service would be reloaded and that value would be inherited for either (settings `.ini` file,
environment variable, command line arguments or any other accepted mechanism to provide configuration).

Therefore, the complete HTTP payload would look like:

```json
{
  "updates": {
    "auth.saml": {
      "enabled": "true",
      "single_logout": "false"
    }
  },
  "removals": {
    "auth.saml": ["allow_idp_initiated"]
  }
}
```

If any of these settings cannot be overridden or are invalid, an error will be returned and the settings will not be saved to the database.

## Background job (high availability set-ups)

Grafana Enterprise has a built-in scheduled background job that looks into the database every minute for
settings updates. If there are updates, it reloads the Grafana services affected by the detected changes.

The background job synchronizes settings between instances in high availability set-ups, ensuring that all instances have the same settings. So, after you perform some changes through the
HTTP API, the other instances are synchronized through the database and the background job.

## Control access with role-based access control

If you have [role-based access control]({{< relref "../../../administration/roles-and-permissions/access-control/" >}}) enabled, you can control who can read or update settings.
Refer to the [Admin API]({{< relref "../../../developers/http_api/admin/#update-settings" >}}) for more information.
