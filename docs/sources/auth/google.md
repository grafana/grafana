+++
title = "Google OAuth2 Authentication"
description = "Grafana OAuthentication Guide "
keywords = ["grafana", "configuration", "documentation", "oauth"]
weight = 600
+++

# Google OAuth2 Authentication

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

Specify the Client ID and Secret in the [Grafana configuration file]({{< relref "../administration/configuration.md#config-file-locations" >}}). For example:

```bash
#################################### Google Auth #########################
[auth.google]
enabled = true
allow_sign_up = true
client_id = some_client_id
client_secret =
scopes = https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email
auth_url = https://accounts.google.com/o/oauth2/auth
token_url = https://accounts.google.com/o/oauth2/token
api_url = https://www.googleapis.com/oauth2/v1/userinfo
allowed_domains = mycompany.com mycompany.org
hosted_domain =
```

WWhile `allowed_domains` is a Grafana property, `hosted_domain` is a Google OAuth property sent with the OAuth request to Google. For more information,  refer to [Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2/openid-connect).

You may have to set the `root_url` option of `[server]` for the callback URL to be
correct. For example in case you are serving Grafana behind a proxy. 

Restart the Grafana back-end. You should now see a Google login button
on the login page. You can now login or sign up with your Google
accounts. The `allowed_domains` option is optional, and domains were separated by space.

You may allow users to sign-up via Google authentication by setting the
`allow_sign_up` option to `true`. When this option is set to `true`, any
user successfully authenticating via Google authentication will be
automatically signed up.
