---
aliases:
  - ../../enterprise/settings-updates/
description: Settings updates at runtime
keywords:
  - grafana
  - runtime
  - settings
labels:
  products:
    - enterprise
    - oss
title: Settings updates at runtime
weight: 500
---

# Settings updates at runtime

{{% admonition type="note" %}}
This functionality is deprecated and will be removed in a future release. For configuring SAML authentication, please use the new [SSO settings API](../../../developers/http_api/sso-settings/).
{{% /admonition %}}

By updating settings at runtime, you can update Grafana settings without needing to restart the Grafana server.

Updates that happen at runtime are stored in the database and override
[settings from other sources](../)
(arguments, environment variables, settings file, etc). Therefore, every time a specific setting key is removed at runtime,
the value used for that key is the inherited one from the other sources in the reverse order of precedence
(`arguments > environment variables > settings file`). When no value is provided through any of these options, then the value used will be the application default

Currently, **it only supports updates on the `auth.saml` section.**

## Update settings via the API

You can update settings through the [Admin API](../../../developers/http_api/admin/#update-settings).

When you submit a settings update via API, Grafana verifies if the given settings updates are allowed and valid. If they are, then Grafana stores the settings in the database and reloads
Grafana services with no need to restart the instance.

So, the payload of a `PUT` request to the update settings endpoint (`/api/admin/settings`)
should contain (either one or both):

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
  "removals": {
    "auth.saml": ["allow_idp_initiated"]
  }
}
```

it would remove the key/value setting identified by `allow_idp_initiated` within the `auth.saml`.
So, the SAML service would be reloaded and that value would be inherited for either (settings `.ini` file,
environment variable, command line arguments or any other accepted mechanism to provide configuration).

Therefore, the complete HTTP payload would looks like:

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

In case any of these settings cannot be overridden nor valid, it would return an error and these settings
won't be persisted into the database.

## Background job (high availability set-ups)

Grafana Enterprise has a built-in scheduled background job that looks into the database every minute for
settings updates. If there are updates, it reloads the Grafana services affected by the detected changes.

The background job synchronizes settings between instances in a highly available set-up. So, after you perform some changes through the
HTTP API, then the other instances are synchronized through the database and the background job.

## Control access with role-based access control

If you have [role-based access control](../../../administration/roles-and-permissions/access-control/) enabled, you can control who can read or update settings.
Refer to the [Admin API](../../../developers/http_api/admin/#update-settings) for more information.
