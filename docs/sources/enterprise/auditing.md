+++
title = "Auditing"
description = "Auditing"
keywords = ["grafana", "auditing", "audit", "logs"]
weight = 1100
+++

# Auditing

> **Note:** Only available in Grafana Enterprise v7.3+.

Auditing allows you to track important changes to your Grafana instance. By default, audit logs are logged to file but the auditing feature also supports sending logs directly to Loki.

## Audit logs

Audit logs are JSON objects representing user actions like:

- Modifications ro resources such as dashboards and data sources.
- A user failing to log in.

### Format

Audit logs contain the following fields. The fields followed by **\*** are always available, the others depend on the type of action logged.

| Field name | Type | Description |
| ---------- | ---- | ----------- |
| `timestamp`\* | string | The date and time the request was made, in coordinated universal time (UTC) using the [RFC3339](https://tools.ietf.org/html/rfc3339#section-5.6) format. |
| `user`\* | object | Information about the user that made the request. Either one of the `UserID` or `ApiKeyID` fields will contain content if `isAnonymous=false`. |
| `user.userId` | number | ID of the Grafana user that made the request. |
| `user.orgId`\* | number | Current organization of the user that made the request. |
| `user.orgRole` | string | Current role of the user that made the request. |
| `user.name` | string | Name of the Grafana user that made the request. |
| `user.tokenId` | number | ID of the user authentication token. |
| `user.apiKeyId` | number | ID of the Grafana API key used to make the request. |
| `user.isAnonymous`\* | boolean | If an anonymous user made the request, `true`. Otherwise, `false`. |
| `action`\* | string | The request action. For example, `create`, `update`, or `manage-permissions`. |
| `request`\* | object | Information about the HTTP request. |
| `request.params` | object | Request’s path parameters. |
| `request.query` | object | Request’s query parameters. |
| `request.body` | string | Request’s body. |
| `result`\* | object | Information about the HTTP response. |
| `result.statusType` | string | If the request action was successful, `success`. Otherwise, `failure`. |
| `result.statusCode` | number | HTTP status of the request. |
| `result.failureMessage` | string | HTTP error message. |
| `result.body` | string | Response body. |
| `resources` | array | Information about the resources that the request action affected. This field can be null for non-resource actions such as `login` or `logout`. |
| `resources[x].id`\* | number | ID of the resource. |
| `resources[x].type`\* | string | The type of the resource that was logged: `alert`, `alert-notification`, `annotation`, `api-key`, `auth-token`, `dashboard`, `datasource`, `folder`, `org`, `panel`, `playlist`, `report`, `team`, `user`, or `version`. |
| `requestUri`\* | string | Request URI. |
| `ipAddress`\* | string | IP address that the request was made from. |
| `userAgent`\* | string | Agent through which the request was made. |
| `grafanaVersion`\* | string | Current version of Grafana when this log is created. |
| `additionalData` | object |  Additional information that can be provided about the request. |

The `additionalData` field can contain the following information:
| Field name | Action | Description |
| ---------- | ------ | ----------- |
| `loginUsername` | `login` | Login used in the Grafana authentication form. |
| `extUserInfo` | `login` |  User information provided by the external system that was used to log in. |
| `authTokenCount` | `login` | Number of active authentication tokens for the user that logged in. |
| `terminationReason` | `logout` | The reason why the user logged out, such as a manual logout or a token expiring.  |     

### Recorded actions

The audit logs include records about the following categories of actions:

**Sessions**

- Log in.
- Log out (manual log out, token expired/revoked, [SAML Single Logout]({{< relref "saml.md#single-logout" >}})).
- Revoke a user authentication token.
- Create or delete an API key.

**User management**

- Create, update, or delete a user.
- Enable or disable a user.
- Manage user role and permissions.
- LDAP sync or information access.

**Team and organization management**

- Create, update, or delete a team or organization.
- Add or remove a member of a team or organization.
- Manage organization members roles.
- Manage team members permissions.
- Invite an external member to an organization.
- Revoke a pending invitation to an organization.
- Add or remove an external group to sync with a team.

**Folder and dashboard management**

- Create, update, or delete a folder.
- Manage folder permissions.
- Create, import, update, or delete a dashboard.
- Restore an old dashboard version.
- Manage dashboard permissions.

**Data sources management**

- Create, update, or delete a data source.
- Manage data source permissions.

**Alerts and notification channels management**

- Create, update, or delete a notification channel.
- Test an alert or a notification channel.
- Pause an alert.

**Reporting**

- Create, update, or delete a report.
- Update reporting settings.
- Send reporting email.

**Annotations, playlists and snapshots management**

- Create, update, or delete an annotation.
- Create, update, or delete a playlist.
- Create or delete a snapshot.

## Configuration

> **Note:** The auditing feature is disabled by default.

Audit logs can be saved into files, sent to a Loki instance or sent to the Grafana default logger. By default, only the file exporter is enabled.
You can choose which exporter to use in the [configuration file]({{< relref "../administration/configuration.md" >}}).

Options are `file`, `loki`, and `console`. Use spaces to separate multiple modes, such as `file loki`.

By default, when a user creates or updates a dashboard, its content will not appear in the logs as it can significantly increase the size of your logs. If this is important information for you and you can handle the amount of data generated, then you can enable this option in the configuration.

```ini
[auditing]
# Enable the auditing feature
enabled = false
# List of enabled loggers
loggers = file
# Keep dashboard content in the logs (request or response fields); this can significantly increase the size of your logs.
log_dashboard_content = false
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

> The HTTP option for the Loki exporter is only available in Grafana Enterprise v7.4+.

```ini
[auditing.logs.loki]
# Set the communication protocol to use with Loki (can be grpc or http)
type = grpc
# Set the address for writing logs to Loki (format must be host:port)
url = localhost:9095
# Defaults to true. If true, it establishes a secure connection to Loki
tls = true
```

If you have multiple Grafana instances sending logs to the same Loki service or if you are using Loki for non-audit logs, audit logs come with additional labels to help identifying them:

- **host** - OS hostname on which the Grafana instance is running.
- **grafana_instance** - Application URL.
- **kind** - `auditing`

### Console exporter

Audit logs are sent to the Grafana default logger. The audit logs use the `auditing.console` logger and are logged on `debug`-level, learn how to enable debug logging in the [log configuration]({{< relref "../administration/configuration.md#log" >}}) section of the documentation. Accessing the audit logs in this way is not recommended for production use.
