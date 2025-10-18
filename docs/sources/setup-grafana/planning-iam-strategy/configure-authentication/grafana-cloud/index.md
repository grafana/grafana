---
aliases:
  - ../../../auth/grafana-cloud/
description: Grafana Cloud Authentication
labels:
  products:
    - cloud
menuTitle: Grafana Cloud OAuth2
title: Configure Grafana Cloud authentication
weight: 1200
---

# Configure Grafana Cloud authentication

To enable Grafana Cloud as the Identity Provider for a Grafana instance, generate a client ID and client secret and apply the configuration to Grafana.

## Create Grafana Cloud OAuth Client Credentials

To use Grafana Cloud authentication:

1. Log in to [Grafana Cloud](/).
1. To create an OAuth client, locate your organization and click **OAuth Clients**.
1. Click **Add OAuth Client Application**.
1. Add the name and URL of your running Grafana instance.
1. Click **Add OAuth Client**.
1. Copy the client ID and client secret or the configuration that has been generated.

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

If a user signs in with their Grafana Cloud credentials, their assigned org role overrides the role defined in the Grafana instance. To prevent Grafana Cloud roles from synchronizing, set `skip_org_role_sync` to `true`. This is useful if you want to manage the organization roles for your users from within Grafana.

```ini
[auth.grafana_com]
# ..
# prevents the sync of org roles from Grafana.com
skip_org_role_sync = true
```
