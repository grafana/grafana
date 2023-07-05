---
aliases:
  - ../../../auth/google/
description: Grafana OAuthentication Guide
title: Configure Google OAuth2 authentication
menuTitle: Google OAuth2
weight: 1100
---

# Configure Google OAuth2 authentication

To enable Google OAuth2 you must register your application with Google. Google will generate a client ID and secret key for you to use.

## Create Google OAuth keys

First, you need to create a Google OAuth Client:

1. Go to https://console.developers.google.com/apis/credentials.
1. Click **Create Credentials**, then click **OAuth Client ID** in the drop-down menu
1. Enter the following:
   - Application Type: Web Application
   - Name: Grafana
   - Authorized JavaScript Origins: https://grafana.mycompany.com
   - Authorized Redirect URLs: https://grafana.mycompany.com/login/google
   - Replace https://grafana.mycompany.com with the URL of your Grafana instance.
1. Click Create
1. Copy the Client ID and Client Secret from the 'OAuth Client' modal

## Enable Google OAuth in Grafana

Specify the Client ID and Secret in the [Grafana configuration file]({{< relref "../../../configure-grafana#configuration-file-location" >}}). For example:

```bash
[auth.google]
enabled = true
allow_sign_up = true
auto_login = false
client_id = CLIENT_ID
client_secret = CLIENT_SECRET
scopes = openid email profile
auth_url = https://accounts.google.com/o/oauth2/v2/auth
token_url = https://oauth2.googleapis.com/token
api_url = https://openidconnect.googleapis.com/v1/userinfo
allowed_domains = mycompany.com mycompany.org
hosted_domain = mycompany.com
use_pkce = true
```

You may have to set the `root_url` option of `[server]` for the callback URL to be
correct. For example in case you are serving Grafana behind a proxy.

Restart the Grafana back-end. You should now see a Google login button
on the login page. You can now login or sign up with your Google
accounts. The `allowed_domains` option is optional, and domains were separated by space.

You may allow users to sign-up via Google authentication by setting the
`allow_sign_up` option to `true`. When this option is set to `true`, any
user successfully authenticating via Google authentication will be
automatically signed up.

You may specify a domain to be passed as `hd` query parameter accepted by Google's
OAuth 2.0 authentication API. Refer to Google's OAuth [documentation](https://developers.google.com/identity/openid-connect/openid-connect#hd-param).

### PKCE

IETF's [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)
introduces "proof key for code exchange" (PKCE) which provides
additional protection against some forms of authorization code
interception attacks. PKCE will be required in [OAuth 2.1](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-03).

> You can disable PKCE in Grafana by setting `use_pkce` to `false` in the`[auth.google]` section.

### Configure refresh token

> Available in Grafana v9.3 and later versions.

> **Note:** This feature is behind the `accessTokenExpirationCheck` feature toggle.

When a user logs in using an OAuth provider, Grafana verifies that the access token has not expired. When an access token expires, Grafana uses the provided refresh token (if any exists) to obtain a new access token.

Grafana uses a refresh token to obtain a new access token without requiring the user to log in again. If a refresh token doesn't exist, Grafana logs the user out of the system after the access token has expired.

By default, Grafana includes the `access_type=offline` parameter in the authorization request to request a refresh token.

### Configure automatic login

Set `auto_login` option to true to attempt login automatically, skipping the login screen.
This setting is ignored if multiple auth providers are configured to use auto login.

```
auto_login = true
```

## Skip organization role sync

We do not currently sync roles from Google and instead set the AutoAssigned role to the user at first login. To manage your user's organization role from within Grafana, set `skip_org_role_sync` to `true`.

```ini
[auth.google]
# ..
skip_org_role_sync = true
```

### Configure team sync for Google OAuth

> Available in Grafana v10.1.0 and later versions.

With team sync, you can easily add users to teams by utilizing their Google groups. To set up team sync for Google OAuth, refer to the following example.

1. Enable the Google Cloud Identity API on your [organization's dashboard](https://console.cloud.google.com/apis/api/cloudidentity.googleapis.com/).

1. Add the `https://www.googleapis.com/auth/cloud-identity.groups.readonly` scope to your Grafana `[auth.google]` configuration:

   Example:

   ```ini
   [auth.google]
   # ..
   scopes = openid email profile https://www.googleapis.com/auth/cloud-identity.groups.readonly
   ```

1. Configure team sync in your Grafana team's `External group sync` tab.
   The external group ID for a Google group is the group's email address, such as `dev@grafana.com`.

To learn more about Team Sync, refer to [Configure Team Sync]({{< relref "../../configure-team-sync" >}}).
