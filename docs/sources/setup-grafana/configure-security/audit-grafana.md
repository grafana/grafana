---
aliases:
  - ../../enterprise/auditing/
description: Auditing
keywords:
  - grafana
  - auditing
  - audit
  - logs
labels:
  products:
    - cloud
    - enterprise
title: Audit a Grafana instance
weight: 800
---

# Audit a Grafana instance

Auditing allows you to track important changes to your Grafana instance. By default, audit logs are logged to file but the auditing feature also supports sending logs directly to Loki.

{{< admonition type="note" >}}
To enable sending Grafana Cloud audit logs to your Grafana Cloud Logs instance, please [file a support ticket](/profile/org/tickets/new). Note that standard ingest and retention rates apply for ingesting these audit logs.
{{< /admonition >}}

Only API requests or UI actions that trigger an API request generate an audit log.

{{< admonition type="note" >}}
Available in [Grafana Enterprise](../../../introduction/grafana-enterprise/) and [Grafana Cloud](/docs/grafana-cloud).
{{< /admonition >}}

## Audit logs

Audit logs are JSON objects representing user actions like:

- Modifications to resources such as dashboards and data sources.
- A user failing to log in.

### Format

Audit logs contain the following fields. The fields followed by **\*** are always available, the others depend on the type of action logged.

| Field name              | Type    | Description                                                                                                                                                                                                              |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `timestamp`\*           | string  | The date and time the request was made, in coordinated universal time (UTC) using the [RFC3339](https://tools.ietf.org/html/rfc3339#section-5.6) format.                                                                 |
| `user`\*                | object  | Information about the user that made the request. Either one of the `UserID` or `ApiKeyID` fields will contain content if `isAnonymous=false`.                                                                           |
| `user.userId`           | number  | ID of the Grafana user that made the request.                                                                                                                                                                            |
| `user.orgId`\*          | number  | Current organization of the user that made the request.                                                                                                                                                                  |
| `user.orgRole`          | string  | Current role of the user that made the request.                                                                                                                                                                          |
| `user.name`             | string  | Name of the Grafana user that made the request.                                                                                                                                                                          |
| `user.authTokenId`      | number  | ID of the user authentication token.                                                                                                                                                                                     |
| `user.apiKeyId`         | number  | ID of the Grafana API key used to make the request.                                                                                                                                                                      |
| `user.isAnonymous`\*    | boolean | If an anonymous user made the request, `true`. Otherwise, `false`.                                                                                                                                                       |
| `action`\*              | string  | The request action. For example, `create`, `update`, or `manage-permissions`.                                                                                                                                            |
| `request`\*             | object  | Information about the HTTP request.                                                                                                                                                                                      |
| `request.params`        | object  | Request’s path parameters.                                                                                                                                                                                               |
| `request.query`         | object  | Request’s query parameters.                                                                                                                                                                                              |
| `request.body`          | string  | Request’s body. Filled with `<non-marshalable format>` when it isn't a valid JSON.                                                                                                                                       |
| `result`\*              | object  | Information about the HTTP response.                                                                                                                                                                                     |
| `result.statusType`     | string  | If the request action was successful, `success`. Otherwise, `failure`.                                                                                                                                                   |
| `result.statusCode`     | number  | HTTP status of the request.                                                                                                                                                                                              |
| `result.failureMessage` | string  | HTTP error message.                                                                                                                                                                                                      |
| `result.body`           | string  | Response body. Filled with `<non-marshalable format>` when it isn't a valid JSON.                                                                                                                                        |
| `resources`             | array   | Information about the resources that the request action affected. This field can be null for non-resource actions such as `login` or `logout`.                                                                           |
| `resources[x].id`\*     | number  | ID of the resource.                                                                                                                                                                                                      |
| `resources[x].type`\*   | string  | The type of the resource that was logged: `alert`, `alert-notification`, `annotation`, `api-key`, `auth-token`, `dashboard`, `datasource`, `folder`, `org`, `panel`, `playlist`, `report`, `team`, `user`, or `version`. |
| `requestUri`\*          | string  | Request URI.                                                                                                                                                                                                             |
| `ipAddress`\*           | string  | IP address that the request was made from.                                                                                                                                                                               |
| `userAgent`\*           | string  | Agent through which the request was made.                                                                                                                                                                                |
| `grafanaVersion`\*      | string  | Current version of Grafana when this log is created.                                                                                                                                                                     |
| `additionalData`        | object  | Additional information that can be provided about the request.                                                                                                                                                           |

The `additionalData` field can contain the following information:
| Field name | Action | Description |
| ---------- | ------ | ----------- |
| `loginUsername` | `login` | Login used in the Grafana authentication form. |
| `extUserInfo` | `login` | User information provided by the external system that was used to log in. |
| `authTokenCount` | `login` | Number of active authentication tokens for the user that logged in. |
| `terminationReason` | `logout` | The reason why the user logged out, such as a manual logout or a token expiring. |
| `billing_role` | `billing-information` | The billing role associated with the billing information being sent. |

### Recorded actions

The audit logs include records about the following categories of actions. Each action is
distinguished by the `action` and `resources[...].type` fields in the JSON record.

For example, creating an API key produces an audit log like this:

```json {hl_lines=4}
{
  "action": "create",
  "resources": [
    {
      "id": 1,
      "type": "api-key"
    }
  ],
  "timestamp": "2021-11-12T22:12:36.144795692Z",
  "user": {
    "userId": 1,
    "orgId": 1,
    "orgRole": "Admin",
    "username": "admin",
    "isAnonymous": false,
    "authTokenId": 1
  },
  "request": {
    "body": "{\"name\":\"example\",\"role\":\"Viewer\",\"secondsToLive\":null}"
  },
  "result": {
    "statusType": "success",
    "statusCode": 200,
    "responseBody": "{\"id\":1,\"name\":\"example\"}"
  },
  "resources": [
    {
      "id": 1,
      "type": "api-key"
    }
  ],
  "requestUri": "/api/auth/keys",
  "ipAddress": "127.0.0.1:54652",
  "userAgent": "Mozilla/5.0 (X11; Linux x86_64; rv:94.0) Gecko/20100101 Firefox/94.0",
  "grafanaVersion": "8.3.0-pre"
}
```

Some actions can only be distinguished by their `requestUri` fields. For those actions, the relevant
pattern of the `requestUri` field is given.

Note that almost all these recorded actions are actions that correspond to API requests or UI actions that
trigger an API request. Therefore, the action `{"action": "email", "resources": [{"type": "report"}]}` corresponds
to the action when the user requests a report's preview to be sent through email, and not the scheduled ones.

#### Sessions

| Action                           | Distinguishing fields                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| Log in                           | `{"action": "login-AUTH-MODULE"}` \*                                                       |
| Log out \*\*                     | `{"action": "logout"}`                                                                     |
| Force logout for user            | `{"action": "logout-user"}`                                                                |
| Remove user authentication token | `{"action": "revoke-auth-token", "resources": [{"type": "auth-token"}, {"type": "user"}]}` |
| Create API key                   | `{"action": "create", "resources": [{"type": "api-key"}]}`                                 |
| Delete API key                   | `{"action": "delete", "resources": [{"type": "api-key"}]}`                                 |

\* Where `AUTH-MODULE` is the name of the authentication module: `grafana`, `saml`,
`ldap`, etc. \
\*\* Includes manual log out, token expired/revoked, and [SAML Single Logout](../configure-authentication/saml/#single-logout).

#### Service accounts

| Action                       | Distinguishing fields                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| Create service account       | `{"action": "create", "resources": [{"type": "service-account"}]}`                                    |
| Update service account       | `{"action": "update", "resources": [{"type": "service-account"}]}`                                    |
| Delete service account       | `{"action": "delete", "resources": [{"type": "service-account"}]}`                                    |
| Create service account token | `{"action": "create", "resources": [{"type": "service-account"}, {"type": "service-account-token"}]}` |
| Delete service account token | `{"action": "delete", "resources": [{"type": "service-account"}, {"type": "service-account-token"}]}` |
| Hide API keys                | `{"action": "hide-api-keys"}`                                                                         |
| Migrate API keys             | `{"action": "migrate-api-keys"}`                                                                      |
| Migrate API key              | `{"action": "migrate-api-keys"}, "resources": [{"type": "api-key"}]}`                                 |

#### Access control

| Action                                   | Distinguishing fields                                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Create role                              | `{"action": "create", "resources": [{"type": "role"}]}`                                                                     |
| Update role                              | `{"action": "update", "resources": [{"type": "role"}]}`                                                                     |
| Delete role                              | `{"action": "delete", "resources": [{"type": "role"}]}`                                                                     |
| Assign built-in role                     | `{"action": "assign-builtin-role", "resources": [{"type": "role"}, {"type": "builtin-role"}]}`                              |
| Remove built-in role                     | `{"action": "remove-builtin-role", "resources": [{"type": "role"}, {"type": "builtin-role"}]}`                              |
| Grant team role                          | `{"action": "grant-team-role", "resources": [{"type": "team"}]}`                                                            |
| Set team roles                           | `{"action": "set-team-roles", "resources": [{"type": "team"}]}`                                                             |
| Revoke team role                         | `{"action": "revoke-team-role", "resources": [{"type": "role"}, {"type": "team"}]}`                                         |
| Grant user role                          | `{"action": "grant-user-role", "resources": [{"type": "role"}, {"type": "user"}]}`                                          |
| Set user roles                           | `{"action": "set-user-roles", "resources": [{"type": "user"}]}`                                                             |
| Revoke user role                         | `{"action": "revoke-user-role", "resources": [{"type": "role"}, {"type": "user"}]}`                                         |
| Set user permissions on folder           | `{"action": "set-user-permissions-on-folder", "resources": [{"type": "folder"}, {"type": "user"}]}`                         |
| Set team permissions on folder           | `{"action": "set-team-permissions-on-folder", "resources": [{"type": "folder"}, {"type": "team"}]}`                         |
| Set basic role permissions on folder     | `{"action": "set-basic-role-permissions-on-folder", "resources": [{"type": "folder"}, {"type": "builtin-role"}]}`           |
| Set user permissions on dashboard        | `{"action": "set-user-permissions-on-dashboards", "resources": [{"type": "dashboard"}, {"type": "user"}]}`                  |
| Set team permissions on dashboard        | `{"action": "set-team-permissions-on-dashboards", "resources": [{"type": "dashboard"}, {"type": "team"}]}`                  |
| Set basic role permissions on dashboard  | `{"action": "set-basic-role-permissions-on-dashboards", "resources": [{"type": "dashboard"}, {"type": "builtin-role"}]}`    |
| Set user permissions on team             | `{"action": "set-user-permissions-on-teams", "resources": [{"type": "teams"}, {"type": "user"}]}`                           |
| Set user permissions on service account  | `{"action": "set-user-permissions-on-service-accounts", "resources": [{"type": "service-account"}, {"type": "user"}]}`      |
| Set user permissions on datasource       | `{"action": "set-user-permissions-on-data-sources", "resources": [{"type": "datasource"}, {"type": "user"}]}`               |
| Set team permissions on datasource       | `{"action": "set-team-permissions-on-data-sources", "resources": [{"type": "datasource"}, {"type": "team"}]}`               |
| Set basic role permissions on datasource | `{"action": "set-basic-role-permissions-on-data-sources", "resources": [{"type": "datasource"}, {"type": "builtin-role"}]}` |

#### User management

| Action                    | Distinguishing fields                                               |
| ------------------------- | ------------------------------------------------------------------- |
| Create user               | `{"action": "create", "resources": [{"type": "user"}]}`             |
| Update user               | `{"action": "update", "resources": [{"type": "user"}]}`             |
| Delete user               | `{"action": "delete", "resources": [{"type": "user"}]}`             |
| Disable user              | `{"action": "disable", "resources": [{"type": "user"}]}`            |
| Enable user               | `{"action": "enable", "resources": [{"type": "user"}]}`             |
| Update password           | `{"action": "update-password", "resources": [{"type": "user"}]}`    |
| Send password reset email | `{"action": "send-reset-email"}`                                    |
| Reset password            | `{"action": "reset-password"}`                                      |
| Update permissions        | `{"action": "update-permissions", "resources": [{"type": "user"}]}` |
| Send signup email         | `{"action": "signup-email"}`                                        |
| Click signup link         | `{"action": "signup"}`                                              |
| Reload LDAP configuration | `{"action": "ldap-reload"}`                                         |
| Get user in LDAP          | `{"action": "ldap-search"}`                                         |
| Sync user with LDAP       | `{"action": "ldap-sync", "resources": [{"type": "user"}]`           |

#### Team and organization management

| Action                               | Distinguishing fields                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| Add team                             | `{"action": "create", "requestUri": "/api/teams"}`                           |
| Update team                          | `{"action": "update", "requestUri": "/api/teams/TEAM-ID"}`\*                 |
| Delete team                          | `{"action": "delete", "requestUri": "/api/teams/TEAM-ID"}`\*                 |
| Add external group for team          | `{"action": "create", "requestUri": "/api/teams/TEAM-ID/groups"}`\*          |
| Remove external group for team       | `{"action": "delete", "requestUri": "/api/teams/TEAM-ID/groups/GROUP-ID"}`\* |
| Add user to team                     | `{"action": "create", "resources": [{"type": "user"}, {"type": "team"}]}`    |
| Update team member permissions       | `{"action": "update", "resources": [{"type": "user"}, {"type": "team"}]}`    |
| Remove user from team                | `{"action": "delete", "resources": [{"type": "user"}, {"type": "team"}]}`    |
| Create organization                  | `{"action": "create", "resources": [{"type": "org"}]}`                       |
| Update organization                  | `{"action": "update", "resources": [{"type": "org"}]}`                       |
| Delete organization                  | `{"action": "delete", "resources": [{"type": "org"}]}`                       |
| Add user to organization             | `{"action": "create", "resources": [{"type": "org"}, {"type": "user"}]}`     |
| Change user role in organization     | `{"action": "update", "resources": [{"type": "user"}, {"type": "org"}]}`     |
| Remove user from organization        | `{"action": "delete", "resources": [{"type": "user"}, {"type": "org"}]}`     |
| Invite external user to organization | `{"action": "org-invite", "resources": [{"type": "org"}, {"type": "user"}]}` |
| Revoke invitation                    | `{"action": "revoke-org-invite", "resources": [{"type": "org"}]}`            |

\* Where `TEAM-ID` is the ID of the affected team, and `GROUP-ID` (if present) is the ID of the
external group.

#### Folder and dashboard management

| Action                        | Distinguishing fields                                                    |
| ----------------------------- | ------------------------------------------------------------------------ |
| Create folder                 | `{"action": "create", "resources": [{"type": "folder"}]}`                |
| Update folder                 | `{"action": "update", "resources": [{"type": "folder"}]}`                |
| Update folder permissions     | `{"action": "manage-permissions", "resources": [{"type": "folder"}]}`    |
| Delete folder                 | `{"action": "delete", "resources": [{"type": "folder"}]}`                |
| Create/update dashboard       | `{"action": "create-update", "resources": [{"type": "dashboard"}]}`      |
| Import dashboard              | `{"action": "create", "resources": [{"type": "dashboard"}]}`             |
| Update dashboard permissions  | `{"action": "manage-permissions", "resources": [{"type": "dashboard"}]}` |
| Restore old dashboard version | `{"action": "restore", "resources": [{"type": "dashboard"}]}`            |
| Delete dashboard              | `{"action": "delete", "resources": [{"type": "dashboard"}]}`             |

#### Library elements management

| Action                 | Distinguishing fields                                              |
| ---------------------- | ------------------------------------------------------------------ |
| Create library element | `{"action": "create", "resources": [{"type": "library-element"}]}` |
| Update library element | `{"action": "update", "resources": [{"type": "library-element"}]}` |
| Delete library element | `{"action": "delete", "resources": [{"type": "library-element"}]}` |

#### Data sources management

| Action                                             | Distinguishing fields                                                                     |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Create datasource                                  | `{"action": "create", "resources": [{"type": "datasource"}]}`                             |
| Update datasource                                  | `{"action": "update", "resources": [{"type": "datasource"}]}`                             |
| Delete datasource                                  | `{"action": "delete", "resources": [{"type": "datasource"}]}`                             |
| Enable permissions for datasource                  | `{"action": "enable-permissions", "resources": [{"type": "datasource"}]}`                 |
| Disable permissions for datasource                 | `{"action": "disable-permissions", "resources": [{"type": "datasource"}]}`                |
| Grant datasource permission to role, team, or user | `{"action": "create", "resources": [{"type": "datasource"}, {"type": "dspermission"}]}`\* |
| Remove datasource permission                       | `{"action": "delete", "resources": [{"type": "datasource"}, {"type": "dspermission"}]}`   |
| Enable caching for datasource                      | `{"action": "enable-cache", "resources": [{"type": "datasource"}]}`                       |
| Disable caching for datasource                     | `{"action": "disable-cache", "resources": [{"type": "datasource"}]}`                      |
| Update datasource caching configuration            | `{"action": "update", "resources": [{"type": "datasource"}]}`                             |

\* `resources` may also contain a third item with `"type":` set to `"user"` or `"team"`.

#### Data source query

| Action           | Distinguishing fields                                        |
| ---------------- | ------------------------------------------------------------ |
| Query datasource | `{"action": "query", "resources": [{"type": "datasource"}]}` |

#### Reporting

| Action                    | Distinguishing fields                                                            |
| ------------------------- | -------------------------------------------------------------------------------- |
| Create report             | `{"action": "create", "resources": [{"type": "report"}, {"type": "dashboard"}]}` |
| Update report             | `{"action": "update", "resources": [{"type": "report"}, {"type": "dashboard"}]}` |
| Delete report             | `{"action": "delete", "resources": [{"type": "report"}]}`                        |
| Send report by email      | `{"action": "email", "resources": [{"type": "report"}]}`                         |
| Update reporting settings | `{"action": "change-settings"}`                                                  |

#### Annotations, playlists and snapshots management

| Action                            | Distinguishing fields                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| Create annotation                 | `{"action": "create", "resources": [{"type": "annotation"}]}`                        |
| Create Graphite annotation        | `{"action": "create-graphite", "resources": [{"type": "annotation"}]}`               |
| Update annotation                 | `{"action": "update", "resources": [{"type": "annotation"}]}`                        |
| Patch annotation                  | `{"action": "patch", "resources": [{"type": "annotation"}]}`                         |
| Delete annotation                 | `{"action": "delete", "resources": [{"type": "annotation"}]}`                        |
| Delete all annotations from panel | `{"action": "mass-delete", "resources": [{"type": "dashboard"}, {"type": "panel"}]}` |
| Create playlist                   | `{"action": "create", "resources": [{"type": "playlist"}]}`                          |
| Update playlist                   | `{"action": "update", "resources": [{"type": "playlist"}]}`                          |
| Delete playlist                   | `{"action": "delete", "resources": [{"type": "playlist"}]}`                          |
| Create a snapshot                 | `{"action": "create", "resources": [{"type": "dashboard"}, {"type": "snapshot"}]}`   |
| Delete a snapshot                 | `{"action": "delete", "resources": [{"type": "snapshot"}]}`                          |
| Delete a snapshot by delete key   | `{"action": "delete", "resources": [{"type": "snapshot"}]}`                          |

#### Provisioning

| Action                            | Distinguishing fields                      |
| --------------------------------- | ------------------------------------------ |
| Reload provisioned dashboards     | `{"action": "provisioning-dashboards"}`    |
| Reload provisioned datasources    | `{"action": "provisioning-datasources"}`   |
| Reload provisioned plugins        | `{"action": "provisioning-plugins"}`       |
| Reload provisioned alerts         | `{"action": "provisioning-alerts"}`        |
| Reload provisioned access control | `{"action": "provisioning-accesscontrol"}` |

#### Plugins management

| Action           | Distinguishing fields     |
| ---------------- | ------------------------- |
| Install plugin   | `{"action": "install"}`   |
| Uninstall plugin | `{"action": "uninstall"}` |

#### Miscellaneous

| Action                   | Distinguishing fields                                        |
| ------------------------ | ------------------------------------------------------------ |
| Set licensing token      | `{"action": "create", "requestUri": "/api/licensing/token"}` |
| Save billing information | `{"action": "billing-information"}`                          |

#### Cloud migration management

| Action                           | Distinguishing fields                                       |
| -------------------------------- | ----------------------------------------------------------- |
| Connect to a cloud instance      | `{"action": "connect-instance"}`                            |
| Disconnect from a cloud instance | `{"action": "disconnect-instance"}`                         |
| Build a snapshot                 | `{"action": "build", "resources": [{"type": "snapshot"}]}`  |
| Upload a snapshot                | `{"action": "upload", "resources": [{"type": "snapshot"}]}` |

#### Generic actions

In addition to the actions listed above, any HTTP request (`POST`, `PATCH`, `PUT`, and `DELETE`)
against the API is recorded with one of the following generic actions.

Furthermore, you can also record `GET` requests. See below how to configure it.

| Action         | Distinguishing fields          |
| -------------- | ------------------------------ |
| POST request   | `{"action": "post-action"}`    |
| PATCH request  | `{"action": "partial-update"}` |
| PUT request    | `{"action": "update"}`         |
| DELETE request | `{"action": "delete"}`         |
| GET request    | `{"action": "retrieve"}`       |

## Configuration

{{< admonition type="note" >}}
The auditing feature is disabled by default.
{{< /admonition >}}

Audit logs can be saved into files, sent to a Loki instance or sent to the Grafana default logger. By default, only the file exporter is enabled.
You can choose which exporter to use in the [configuration file](../../configure-grafana/).

Options are `file`, `loki`, and `logger`. Use spaces to separate multiple modes, such as `file loki`.

By default, when a user creates or updates a dashboard, its content will not appear in the logs as it can significantly increase the size of your logs. If this is important information for you and you can handle the amount of data generated, then you can enable this option in the configuration.

```ini
[auditing]
# Enable the auditing feature
enabled = false
# List of enabled loggers
loggers = file
# Keep dashboard content in the logs (request or response fields); this can significantly increase the size of your logs.
log_dashboard_content = false
# Keep requests and responses body; this can significantly increase the size of your logs.
verbose = false
# Write an audit log for every status code.
# By default it only logs the following ones: 2XX, 3XX, 401, 403 and 500.
log_all_status_codes = false
# Maximum response body (in bytes) to be audited; 500KiB by default.
# May help reducing the memory footprint caused by auditing.
max_response_size_bytes = 512000
```

Each exporter has its own configuration fields.

### File exporter

Audit logs are saved into files. You can configure the folder to use to save these files. Logs are rotated when the file size is exceeded and at the start of a new day.

```ini
[auditing.logs.file]
# Path to logs folder
path = data/log
# Maximum log files to keep
max_files = 5
# Max size in megabytes per log file
max_file_size_mb = 256
```

### Loki exporter

Audit logs are sent to a [Loki](/oss/loki/) service, through HTTP or gRPC.

{{< admonition type="note" >}}
The HTTP option for the Loki exporter is available only in Grafana Enterprise version 7.4 and later.
{{< /admonition >}}

```ini
[auditing.logs.loki]
# Set the communication protocol to use with Loki (can be grpc or http)
type = grpc
# Set the address for writing logs to Loki
url = localhost:9095
# Defaults to true. If true, it establishes a secure connection to Loki
tls = true
# Set the tenant ID for Loki communication, which is disabled by default.
# The tenant ID is required to interact with Loki running in multi-tenant mode.
tenant_id =
```

If you have multiple Grafana instances sending logs to the same Loki service or if you are using Loki for non-audit logs, audit logs come with additional labels to help identifying them:

| Label            | Value                                                |
| ---------------- | ---------------------------------------------------- |
| host             | OS hostname on which the Grafana instance is running |
| grafana_instance | Application URL                                      |
| kind             | `auditing`                                           |

When basic authentication is needed to ingest logs in your Loki instance, you can specify credentials in the URL field. For example:

```ini
# Set the communication protocol to use with Loki (can be grpc or http)
type = http
# Set the address for writing logs to Loki
url = user:password@localhost:3000
```

### Console exporter

Audit logs are sent to the Grafana default logger. The audit logs use the `auditing.console` logger and are logged on `debug`-level, learn how to enable debug logging in the [log configuration](../../configure-grafana/#log) section of the documentation. Accessing the audit logs in this way is not recommended for production use.
