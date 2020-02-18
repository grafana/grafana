+++
title = "OAuth authentication"
description = "Grafana OAuthentication Guide "
keywords = ["grafana", "configuration", "documentation", "oauth"]
type = "docs"
[menu.docs]
name = "Generic OAuth"
identifier = "generic_oauth"
parent = "authentication"
weight = 3
+++

# Generic OAuth Authentication

You can configure many different oauth2 authentication services with Grafana using the generic oauth2 feature. Below you
can find examples using Okta, BitBucket, OneLogin and Azure.

This callback URL must match the full HTTP address that you use in your browser to access Grafana, but with the prefix path of `/login/generic_oauth`.

You may have to set the `root_url` option of `[server]` for the callback URL to be
correct. For example in case you are serving Grafana behind a proxy.

Example config:

```bash
[auth.generic_oauth]
enabled = true
client_id = YOUR_APP_CLIENT_ID
client_secret = YOUR_APP_CLIENT_SECRET
scopes =
auth_url =
token_url =
api_url =
allowed_domains = mycompany.com mycompany.org
allow_sign_up = true
```

Set `api_url` to the resource that returns [OpenID UserInfo](https://connect2id.com/products/server/docs/api/userinfo) compatible information.

Grafana will attempt to determine the user's e-mail address by querying the OAuth provider as described below in the following order until an e-mail address is found:

1. Check for the presence of an e-mail address via the `email` field encoded in the OAuth `id_token` parameter.
2. Check for the presence of an e-mail address using the [JMESPath](http://jmespath.org/examples.html) specified via the `email_attribute_path` configuration option. The JSON used for the path lookup is the HTTP response obtained from querying the UserInfo endpoint specified via the `api_url` configuration option.
**Note**: Only available in Grafana v6.4+.
3. Check for the presence of an e-mail address in the `attributes` map encoded in the OAuth `id_token` parameter. By default Grafana will perform a lookup into the attributes map using the `email:primary` key, however, this is configurable and can be adjusted by using the `email_attribute_name` configuration option.
4. Query the `/emails` endpoint of the OAuth provider's API (configured with `api_url`) and check for the presence of an e-mail address marked as a primary address.
5. If no e-mail address is found in steps (1-4), then the e-mail address of the user is set to the empty string.

Grafana will also attempt to do role mapping through OAuth as described below.

> Only available in Grafana v6.5+.

Check for the presence of an role using the [JMESPath](http://jmespath.org/examples.html) specified via the `role_attribute_path` configuration option. The JSON used for the path lookup is the HTTP response obtained from querying the UserInfo endpoint specified via the `api_url` configuration option. The result after evaluating the `role_attribute_path` JMESPath expression needs to be a valid Grafana role, i.e. `Viewer`, `Editor` or `Admin`.

See [JMESPath examples](#jmespath-examples) for more information.

## Set up OAuth2 with Okta

First set up Grafana as an OpenId client "webapplication" in Okta. Then set the Base URIs to `https://<grafana domain>/` and set the Login redirect URIs to `https://<grafana domain>/login/generic_oauth`.

Finally set up the generic oauth module like this:

```bash
[auth.generic_oauth]
name = Okta
enabled = true
scopes = openid profile email
client_id = <okta application Client ID>
client_secret = <okta application Client Secret>
auth_url = https://<okta domain>/oauth2/v1/authorize
token_url = https://<okta domain>/oauth2/v1/token
api_url = https://<okta domain>/oauth2/v1/userinfo
```

## Set up OAuth2 with Bitbucket

```bash
[auth.generic_oauth]
name = BitBucket
enabled = true
allow_sign_up = true
client_id = <client id>
client_secret = <client secret>
scopes = account email
auth_url = https://bitbucket.org/site/oauth2/authorize
token_url = https://bitbucket.org/site/oauth2/access_token
api_url = https://api.bitbucket.org/2.0/user
team_ids =
allowed_organizations =
```

## Set up OAuth2 with OneLogin

1.  Create a new Custom Connector with the following settings:
    - Name: Grafana
    - Sign On Method: OpenID Connect
    - Redirect URI: `https://<grafana domain>/login/generic_oauth`
    - Signing Algorithm: RS256
    - Login URL: `https://<grafana domain>/login/generic_oauth`

    then:
2.  Add an App to the Grafana Connector:
    - Display Name: Grafana

    then:
3.  Under the SSO tab on the Grafana App details page you'll find the Client ID and Client Secret.

    Your OneLogin Domain will match the URL you use to access OneLogin.

    Configure Grafana as follows:

    ```bash
    [auth.generic_oauth]
    name = OneLogin
    enabled = true
    allow_sign_up = true
    client_id = <client id>
    client_secret = <client secret>
    scopes = openid email name
    auth_url = https://<onelogin domain>.onelogin.com/oidc/auth
    token_url = https://<onelogin domain>.onelogin.com/oidc/token
    api_url = https://<onelogin domain>.onelogin.com/oidc/me
    team_ids =
    allowed_organizations =
    ```

## Set up OAuth2 with Auth0

1.  Create a new Client in Auth0
    - Name: Grafana
    - Type: Regular Web Application

2.  Go to the Settings tab and set:
    - Allowed Callback URLs: `https://<grafana domain>/login/generic_oauth`

3. Click Save Changes, then use the values at the top of the page to configure Grafana:

    ```bash
    [auth.generic_oauth]
    enabled = true
    allow_sign_up = true
    team_ids =
    allowed_organizations =
    name = Auth0
    client_id = <client id>
    client_secret = <client secret>
    scopes = openid profile email
    auth_url = https://<domain>/authorize
    token_url = https://<domain>/oauth/token
    api_url = https://<domain>/userinfo
    ```

## Set up OAuth2 with Azure Active Directory

1.  Log in to portal.azure.com and click "Azure Active Directory" in the side menu, then click the "Properties" sub-menu item.

2.  Copy the "Directory ID", this is needed for setting URLs later

3.  Click "App Registrations" and add a new application registration:
    - Name: Grafana
    - Application type: Web app / API
    - Sign-on URL: `https://<grafana domain>/login/generic_oauth`

4.  Click the name of the new application to open the application details page.

5.  Note down the "Application ID", this will be the OAuth client id.

6.  Click "Certificates & secrets" and add a new entry under Client secrets
    - Description: Grafana OAuth
    - Expires: Never

7.  Click Add then copy the key value, this will be the OAuth client secret.

8.  Configure Grafana as follows:

    ```bash
    [auth.generic_oauth]
    name = Azure AD
    enabled = true
    allow_sign_up = true
    client_id = <application id>
    client_secret = <key value>
    scopes = openid email name
    auth_url = https://login.microsoftonline.com/<directory id>/oauth2/authorize
    token_url = https://login.microsoftonline.com/<directory id>/oauth2/token
    api_url =
    team_ids =
    allowed_organizations =
    ```

> Note: It's important to ensure that the [root_url]({{< relref "../installation/configuration/#root-url" >}}) in Grafana is set in your Azure Application Reply URLs (App -> Settings -> Reply URLs)

## Set up OAuth2 with Centrify

1.  Create a new Custom OpenID Connect application configuration in the Centrify dashboard.

2.  Create a memorable unique Application ID, e.g. "grafana", "grafana_aws", etc.

3.  Put in other basic configuration (name, description, logo, category)

4.  On the Trust tab, generate a long password and put it into the OpenID Connect Client Secret field.

5.  Put the URL to the front page of your Grafana instance into the "Resource Application URL" field.

6.  Add an authorized Redirect URI like https://your-grafana-server/login/generic_oauth

7.  Set up permissions, policies, etc. just like any other Centrify app

8.  Configure Grafana as follows:

    ```bash
    [auth.generic_oauth]
    name = Centrify
    enabled = true
    allow_sign_up = true
    client_id = <OpenID Connect Client ID from Centrify>
    client_secret = <your generated OpenID Connect Client Sercret"
    scopes = openid profile email
    auth_url = https://<your domain>.my.centrify.com/OAuth2/Authorize/<Application ID>
    token_url = https://<your domain>.my.centrify.com/OAuth2/Token/<Application ID>
    api_url = https://<your domain>.my.centrify.com/OAuth2/UserInfo/<Application ID>
    ```

## JMESPath examples

To ease configuring a proper JMESPath expression you can test/evaluate expression with a custom payload at http://jmespath.org/.

### Role mapping

**Basic example:**

In the following example user will get `Editor` as role when authenticating. The value of the property `role` will be the resulting role if the role is a proper Grafana role, i.e. `Viewer`, `Editor` or `Admin`.

Payload:
```json
{
    ...
    "role": "Editor",
    ...
}
```

Config:
```bash
role_attribute_path = role
```

**Advanced example:**

In the following example user will get `Admin` as role when authenticating since it has a group `admin`. If a user has a group `editor` it will get `Editor` as role, otherwise `Viewer`.

Payload:
```json
{
    ...
    "info": {
        ...
        "groups": [
            "engineer",
            "admin",
        ],
        ...
    },
    ...
}
```

Config:
```bash
role_attribute_path = contains(info.groups[*], 'admin') && 'Admin' || contains(info.groups[*], 'editor') && 'Editor' || 'Viewer'
```
