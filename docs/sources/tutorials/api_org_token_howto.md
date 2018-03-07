+++
title = "API Tutorial: How To Create API Tokens And Dashboards For A Specific Organization"
type = "docs"
keywords = ["grafana", "tutorials", "API", "Token", "Org", "Organization"]
[menu.docs]
parent = "tutorials"
weight = 10
+++

# API Tutorial: How To Create API Tokens And Dashboards For A Specific Organization

A common scenario is to want to via the Grafana API setup new Grafana organizations or to add dynamically generated dashboards to an existing organization.

## Authentication

There are two ways to authenticate against the API: basic authentication and API Tokens.

Some parts of the API are only available through basic authentication and these parts of the API usually require that the user is a Grafana Admin. But all organization actions are accessed via an API Token. An API Token is tied to an organization and can be used to create dashboards etc but only for that organization.

## How To Create A New Organization and an API Token

The task is to create a new organization and then add a Token that can be used by other users. In the examples below which use basic auth, the user is `admin` and the password is `admin`.

1. [Create the org](http://docs.grafana.org/http_api/org/#create-organisation). Here is an example using curl:
    ```
    curl -X POST -H "Content-Type: application/json" -d '{"name":"apiorg"}' http://admin:admin@localhost:3000/api/orgs
    ```

    This should return a response: `{"message":"Organization created","orgId":6}`. Use the orgId for the next steps.

2. Optional step. If the org was created previously and/or step 3 fails then first [add your Admin user to the org](http://docs.grafana.org/http_api/org/#add-user-in-organisation):
    ```
    curl -X POST -H "Content-Type: application/json" -d '{"loginOrEmail":"admin", "role": "Admin"}' http://admin:admin@localhost:3000/api/orgs/<org id of new org>/users
    ```

3. [Switch the org context for the Admin user to the new org](http://docs.grafana.org/http_api/user/#switch-user-context):
    ```
    curl -X POST http://admin:admin@localhost:3000/api/user/using/<id of new org>
    ```

4. [Create the API token](http://docs.grafana.org/http_api/auth/#create-api-key):
    ```
    curl -X POST -H "Content-Type: application/json" -d '{"name":"apikeycurl", "role": "Admin"}' http://admin:admin@localhost:3000/api/auth/keys
    ```

    This should return a response: `{"name":"apikeycurl","key":"eyJrIjoiR0ZXZmt1UFc0OEpIOGN5RWdUalBJTllUTk83VlhtVGwiLCJuIjoiYXBpa2V5Y3VybCIsImlkIjo2fQ=="}`.

    Save the key returned here in your password manager as it is not possible to fetch again it in the future.

## How To Add A Dashboard

Using the Token that was created in the previous step, you can create a dashboard or carry out other actions without having to switch organizations. 

1. [Add a dashboard](http://docs.grafana.org/http_api/dashboard/#create-update-dashboard) using the key (or bearer token as it is also called):

  ```
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

  This import will not work if you exported the dashboard via the Share -> Export menu in the Grafana UI (it strips out data source names etc.). View the JSON and save it to a file instead or fetch the dashboard JSON via the API.
