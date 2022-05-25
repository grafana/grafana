+++
aliases = ["/docs/grafana/latest/developers/http_api/create-api-tokens-for-org/", "/docs/grafana/latest/http_api/create-api-tokens-for-org/", "/docs/grafana/latest/tutorials/api_org_token_howto/"]
keywords = ["grafana", "tutorials", "API", "Token", "Org", "Organization"]
title = "API Tutorial: Create API tokens and dashboards for an organization"
weight = 150
+++

# Create API tokens and dashboards for an organization

Use the Grafana API to set up new Grafana organizations or to add dynamically generated dashboards to an existing organization.

## Authentication

There are two authentication methods to access the API:

- Basic authentication: A Grafana Admin user can access some parts of the Grafana API through basic authentication.
- API Tokens: All organization actions are accessed through an API Token. An API Token is associated with an organization. It can be used to create dashboards and other components specific for that organization.

## How to create a new organization and an API Token

The task is to create a new organization and then add a Token that can be used by other users. In the examples below which use basic auth, the user is `admin` and the password is `admin`.

1. [Create the org](http://docs.grafana.org/http_api/org/#create-organization). Here is an example using curl:

   ```bash
   curl -X POST -H "Content-Type: application/json" -d '{"name":"apiorg"}' http://admin:admin@localhost:3000/api/orgs
   ```

   This should return a response: `{"message":"Organization created","orgId":6}`. Use the orgId for the next steps.

1. Optional step. If the org was created previously and/or step 3 fails then first [add your Admin user to the org](http://docs.grafana.org/http_api/org/#add-user-in-organization):

   ```bash
   curl -X POST -H "Content-Type: application/json" -d '{"loginOrEmail":"admin", "role": "Admin"}' http://admin:admin@localhost:3000/api/orgs/<org id of new org>/users
   ```

1. [Switch the org context for the Admin user to the new org](http://docs.grafana.org/http_api/user/#switch-user-context-for-signed-in-user):

   ```bash
   curl -X POST http://admin:admin@localhost:3000/api/user/using/<id of new org>
   ```

1. [Create the API token](http://docs.grafana.org/http_api/auth/#create-api-key):

   ```bash
   curl -X POST -H "Content-Type: application/json" -d '{"name":"apikeycurl", "role": "Admin"}' http://admin:admin@localhost:3000/api/auth/keys
   ```

   This should return a response: `{"name":"apikeycurl","key":"eyJrIjoiR0ZXZmt1UFc0OEpIOGN5RWdUalBJTllUTk83VlhtVGwiLCJuIjoiYXBpa2V5Y3VybCIsImlkIjo2fQ=="}`.

   Save the key returned here in your password manager as it is not possible to fetch again it in the future.

## How to add a dashboard

Using the Token that was created in the previous step, you can create a dashboard or carry out other actions without having to switch organizations.

1. [Add a dashboard](http://docs.grafana.org/http_api/dashboard/#create-update-dashboard) using the key (or bearer token as it is also called):

```bash
curl -X POST --insecure -H "Authorization: Bearer eyJrIjoiR0ZXZmt1UFc0OEpIOGN5RWdUalBJTllUTk83VlhtVGwiLCJuIjoiYXBpa2V5Y3VybCIsImlkIjo2fQ==" -H "Content-Type: application/json" -d '{
  "dashboard": {
    "id": null,
    "title": "Production Overview",
    "tags": [ "templated" ],
    "timezone": "browser",
    "rows": [
      {
      }
    ],
    "schemaVersion": 6,
    "version": 0
  },
  "overwrite": false
}' http://localhost:3000/api/dashboards/db
```

> **Note:** If you export a dashboard for sharing externally using the Share > Export menu in the Grafana UI, you cannot import that dashboard. Instead, click **View JSON** and save it to a file or fetch the JSON output through the API.
