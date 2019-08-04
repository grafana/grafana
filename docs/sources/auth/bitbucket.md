+++
title = "Bitbucket OAuth2 authentication"
description = "Grafana OAuthentication Guide "
keywords = ["grafana", "configuration", "documentation", "oauth"]
type = "docs"
[menu.docs]
name = "Bitbucket"
identifier = "bitbucket_oauth"
parent = "authentication"
weight = 3
+++

# Generic OAuth Authentication

You can configure many different oauth2 authentication services with Grafana using the generic oauth2 feature. Below you
can find examples using Okta, BitBucket, OneLogin and Azure.

This callback URL must match the full HTTP address that you use in your browser to access Grafana, but with the prefix path of `/login/bitbucket`.

You may have to set the `root_url` option of `[server]` for the callback URL to be
correct. For example in case you are serving Grafana behind a proxy.

Example config:

```bash
[auth.bitbucket]
name = BitBucket
enabled = true
allow_sign_up = true
client_id = YOUR_APP_CLIENT_ID
client_secret = YOUR_APP_CLIENT_ID
scopes = account email team
auth_url = https://bitbucket.org/site/oauth2/authorize
token_url = https://bitbucket.org/site/oauth2/access_token
api_url = https://api.bitbucket.org/2.0/user
team_ids = teamA teamB
```

You may have to set the `root_url` option of `[server]` for the callback URL to be 
correct. For example in case you are serving Grafana behind a proxy.

Restart the Grafana backend for your changes to take effect.

With `allow_sign_up` set to `false`, only existing users will be able to login
using their Bitbucket account, but with `allow_sign_up` set to `true`, *any* user
who can authenticate to one of the given teams on Bitbucket will be able to login
on your Grafana instance.

You can can however limit access to only members of a given group or list of
groups by setting the `allowed_groups` option.