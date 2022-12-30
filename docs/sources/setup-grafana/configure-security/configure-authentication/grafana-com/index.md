---
aliases:
  - ../../../auth/grafana-com/
description: Grafana Com Authentication
title: Configure Grafana Com authentication
weight: 500
---

# Configure Grafana Com authentication

To enable GrafanaCom as your authentication provider. You configure GrafanaCom to generate a client ID and a secret key for you to use.

## Create Grafana Com OAuth keys

To use Grafana Com authentication:

1. Login on to Grafana com
2. Create an OAuth client by visiting your organization and clicking “OAuth Clients”.
3. Then click “Add OAuth Client Application”.
1. Add the URL of your running Grafana instance.
5. The next step will give you the client ID and secret.

Below is an example of the configuration:

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
