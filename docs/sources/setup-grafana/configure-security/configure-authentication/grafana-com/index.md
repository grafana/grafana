---
aliases:
  - ../../../auth/grafana-com/
description: Grafana Com Authentication
title: Configure Grafana Com authentication
weight: 500
---

# Configure Grafana Com authentication

To enable GrafanaCom as your authentication provider, you configure it to generate a client ID and a secret key.

## Create GrafanaCom OAuth keys

To use GrafanaCom authentication:

1. Log in to [GrafanaCom](https://grafana.com).
1. To create an OAuth client, locate your organization and click **OAuth Clients**.
1. Click **Add OAuth Client Application**.
1. Add the name and URL of your running Grafana instance.
1. Click **Add OAuth Client**.
1. Copy the client ID and secret key or the configuration that has been generated.

The following snippet shows an example configuration:

```ini
[auth.grafana_com]
enabled = true
allow_sign_up = true
auto_login = false
client_id = 450bc21c10dc2194879d
client_secret = eyJ0Ijoib2F1dGgyYyIhlmlkIjoiNzUwYmMzM2MxMGRjMjE6NDh3OWQiLCJ2IjoiZmI1YzVlYmIwYzFmN2ZhYzZmNjIwOGI1NmVkYTRlNWYxMzgwM2NkMiJ9
scopes = user:email
allowed_organizations = sampleorganization
enabled = true
```

### Configure automatic login

Set `auto_login` option to true to attempt login automatically, skipping the login screen.
This setting is ignored if multiple auth providers are configured to use auto login.

```
auto_login = true
```

## Skip organization role sync

To prevent the sync of org roles from Grafana.com, set `skip_org_role_sync` to `true`. This is useful if you want to manage the organization roles for your users from within Grafana.

```ini
[auth.grafana_com]
# ..
# prevents the sync of org roles from Grafana.com
skip_org_role_sync = true
```
