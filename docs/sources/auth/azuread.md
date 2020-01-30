+++
title = "Azure AD OAuth2 Authentication"
description = "Grafana OAuthentication Guide "
keywords = ["grafana", "configuration", "documentation", "oauth"]
type = "docs"
[menu.docs]
name = "Azure AD"
identifier = "azuread_oauth2"
parent = "authentication"
weight = 3
+++

# Azure AD OAuth2 Authentication

To enable the Azure AD OAuth2 you must register your application with Azure AD. Azure AD will generate a client ID and secret key for you to use.

## Create Azure AD application

1. Log in to portal.azure.com and click "Azure Active Directory" in the side menu, then click the "Properties" sub-menu item.

2. Click "App Registrations" and add a new application registration:
   - Name: Grafana
   - Application type: Web app / API
   - Sign-on URL: `https://<grafana domain>/login/azuread`

3. Click the name of the new application to open the application details page.

4. Click "Endpoints"
   - Note down the "OAuth 2.0 authorization endpoint (v2)", this will be the auth url
   - Note down the "OAuth 2.0 token endpoint (v2)", this will be the token url

5.  Note down the "Application ID", this will be the OAuth client id.

6. Click "Certificates & secrets" and add a new entry under Client secrets
    - Description: Grafana OAuth
    - Expires: Never

7. Click Add then copy the key value, this will be the OAuth client secret.

8. Click Manifest
   - Add definitions for the required Application Roles for Grafana (Viewer, Editor, Admin). Without this configuration all users will be assigned to the Viewer role.
   - Every role has to have a unique id. On Linux this can be created with `uuidgen` for instance.

        ```json
        "appRoles": [
        		{
        			"allowedMemberTypes": [
        				"User"
        			],
        			"description": "Grafana admin Users",
        			"displayName": "Grafana Admin",
        			"id": "SOME_UNIQUE_ID",
        			"isEnabled": true,
        			"lang": null,
        			"origin": "Application",
        			"value": "Admin"
        		},
        		{
        			"allowedMemberTypes": [
        				"User"
        			],
        			"description": "Grafana read only Users",
        			"displayName": "Grafana Viewer",
        			"id": "SOME_UNIQUE_ID",
        			"isEnabled": true,
        			"lang": null,
        			"origin": "Application",
        			"value": "Viewer"
        		},
        		{
        			"allowedMemberTypes": [
        				"User"
        			],
        			"description": "Grafana Editor Users",
        			"displayName": "Grafana Editor",
        			"id": "SOME_UNIQUE_ID",
        			"isEnabled": true,
        			"lang": null,
        			"origin": "Application",
        			"value": "Editor"
        		}
        	],
        ```

9. Click Overview and then on "Managed application in local directory" to show the Enterprise Application details

10. Click on "Users and groups" and add Users/Groups to the Grafana roles

11. Configure Grafana as follows:

```bash
[auth.azuread]
name = Azure AD
enabled = true
allow_sign_up = true
client_id = APPLICATION_ID
client_secret = CLIENT_SECRET
scopes = openid email profile
auth_url = https://login.microsoftonline.com/TENANT_ID/oauth2/v2.0/authorize
token_url = https://login.microsoftonline.com/TENANT_ID/oauth2/v2.0/token
```

> Note: It's important to ensure that the [root_url]({{< relref "../installation/configuration/#root-url" >}}) in Grafana is set in your Azure Application Reply URLs (App -> Settings -> Reply URLs)
