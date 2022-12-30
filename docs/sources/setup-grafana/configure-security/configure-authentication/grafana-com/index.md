---
aliases:
  - ../../../auth/grafana-com/
description: Grafana Com Authentication
title: Configure Grafana Com authentication
weight: 500
---

# Configure Grafana Com authentication

To enable GrafanaCom as your authentication provider, you configure it to generate a client ID and a secret key.

## Create Grafana Com OAuth keys

To use Grafana Com authentication:

1. Log in to Grafana Com.
1. To create an OAuth client, locate your organization and click **OAuth Clients**. 
1. Click **Add OAuth Client Application**.
1. Add the URL of your running Grafana instance.
5. The next step will give you the client ID and secret.

The following code shows an example configuration:

```ini
[auth.grafana_com]
enabled = true
allow_sign_up = true
client_id = 450bc21c10dc2194879d
client_secret = eyJ0Ijoib2F1dGgyYyIhlmlkIjoiNzUwYmMzM2MxMGRjMjE6NDh3OWQiLCJ2IjoiZmI1YzVlYmIwYzFmN2ZhYzZmNjIwOGI1NmVkYTRlNWYxMzgwM2NkMiJ9
scopes = user:email
allowed_organizations = sampleorganization
enabled = true

# prevents the sync of org roles from Grafana.com
skip_org_role_sync = false
```

## Skip organization role sync

To prevent the sync of org roles from Grafana.com, set `skip_org_role_sync` to `true`. This is useful if you want to use Grafana.com as an identity provider but want to manage the org roles in Grafana.

```ini
[auth.grafana_com]
# ..
skip_org_role_sync = true
```
