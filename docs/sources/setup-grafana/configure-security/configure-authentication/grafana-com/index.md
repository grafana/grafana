---
aliases:
  - ../../../auth/grafana-com/
description: Grafana Com Authentication
title: Configure Grafana Com authentication
weight: 500
---

# Configure Grafana Com authentication

To use GrafanaCom as your authentication provider, you need to generate a client ID and a secret key by following these steps:

## Create GrafanaCom OAuth keys

To use GrafanaCom authentication:

1. Log in to [GrafanaCom](https://grafana.com).
1. To create an OAuth client, locate your organization and click **OAuth Clients**.
1. Click **Add OAuth Client Application**.
1. Enter the name and URL of your Grafana instance that will use GrafanaCom authentication.
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
To automatically log in to Grafana using GrafanaCom authentication, set the `auto_login` option to `true`. This skips the login screen.

This setting is ignored if multiple auth providers are configured to use auto login.

```
auto_login = true
```

## Skip organization role sync
To prevent the synchronization of organization roles from Grafana.com, set the `skip_org_role_sync` option to `true`. This is useful if you want to manage the organization roles for your users from within Grafana.

```ini
[auth.grafana_com]
# ..
# prevents the sync of org roles from Grafana.com
skip_org_role_sync = true
```
