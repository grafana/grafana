---
aliases:
  - ../../../auth/radius/
description: Grafana RADIUS Authentication Guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: RADIUS
title: Configure RADIUS authentication
weight: 310
---

# Configure RADIUS authentication

The RADIUS integration lets users authenticate to Grafana with credentials verified by a Remote Authentication Dial-In User Service (RADIUS) server. You can optionally map RADIUS Class attribute values returned in an Access-Accept response to Grafana organization roles (and server admin) for automatic role provisioning.

RADIUS authentication is suitable when you already maintain user credentials centrally in a RADIUS server (for example for network / VPN / WiFi access) and want Grafana to reuse those credentials without replicating passwords.

## Overview

At login, Grafana sends a RADIUS Access-Request containing the username and password to the configured RADIUS server. If the server responds with Access-Accept, the user is considered authenticated; Access-Reject or any error is treated as invalid credentials.

If org role synchronization is enabled (default), Grafana inspects all Class (RFC 2865 / RFC 4372) attributes returned in the Access-Accept. It compares them against configured class mappings and assigns organization roles accordingly. If no mapping matches, access is denied (the authentication succeeds but authorization fails). If org role sync is disabled, the user is allowed to sign in without any mapped roles and you can assign roles manually later.

## Enable RADIUS

Enable and configure RADIUS in the main configuration file (`grafana.ini` or `custom.ini`). Minimal example:

```ini
[auth.radius]
enabled = true
server = 10.0.0.5
secret = $__env{RADIUS_SHARED_SECRET}
# Optional overrides
# port = 1812
# allow_sign_up = true
# skip_org_role_sync = false
# timeout_seconds = 10
# email_suffix = example.com
```

Settings:

| Setting | Required | Description | Default |
| ------- | -------- | ----------- | ------- |
| `enabled` | Yes | Enable RADIUS authentication. | `false` |
| `server` | Yes | RADIUS server host or IP address. | (empty) |
| `port` | No | UDP port for authentication requests. | `1812` |
| `secret` | Yes | Shared secret used to sign and encrypt RADIUS attributes (User-Password). | (empty) |
| `allow_sign_up` | No | Allow Grafana to create local user records on first successful login. | `true` |
| `skip_org_role_sync` | No | When `true`, skip mapping Class attributes to organization roles (you must assign roles manually). | `false` |
| `class_mappings` | No | JSON array mapping Class values to org roles/admin. See [Class mappings](#class-mappings). | (empty) |
| `timeout_seconds` | No | Per-request timeout (1–300). If exceeded, login fails as invalid credentials. | `10` |
| `email_suffix` | No | Domain suffix appended to username to form the email if username has no `@`. Prepend not required ("example.com" becomes `user@example.com`). | (empty) |

Environment variable expansion works for any value, for example `secret = ${RADIUS_SECRET}` or using Grafana's `${__env}` syntax.

## Disable org role synchronization

If you prefer to manage organization memberships and roles manually inside Grafana, disable synchronization:

```ini
[auth.radius]
enabled = true
server = 10.0.0.5
secret = $__env{RADIUS_SHARED_SECRET}
skip_org_role_sync = true
```

With `skip_org_role_sync = true`, Grafana will not require a successful class mapping: users are allowed to log in after successful RADIUS authentication even if no mappings exist. They will initially have no org roles until assigned manually.

## Class mappings

Use `class_mappings` to translate RADIUS Class attribute values into Grafana organization roles. The configuration is a JSON array of objects with the following shape:

```json
[
  {"class":"netops-admin","orgId":1,"orgRole":"Admin","isGrafanaAdmin":true},
  {"class":"netops-editors","orgId":1,"orgRole":"Editor"},
  {"class":"analytics-viewers","orgId":2,"orgRole":"Viewer"}
]
```

Place the JSON directly in `grafana.ini` (be mindful of quoting) or manage it via the SSO settings API/UI.

| Field | Required | Description |
| ----- | -------- | ----------- |
| `class` | Yes | Exact Class attribute string returned by the RADIUS server. Multiple distinct Class attributes may be returned; all are evaluated. |
| `orgId` | Yes | Numeric Grafana organization ID to assign the role in. |
| `orgRole` | Yes | One of `Viewer`, `Editor`, `Admin`. |
| `isGrafanaAdmin` | No | When `true`, grants server admin privileges (global). |

Behavior details:
- All Class attributes in the Access-Accept are collected (duplicates removed).
- Each class value is compared to every mapping; matches can add/upgrade roles per org.
- If multiple mappings target the same org, the highest-precedence role wins (`Admin` > `Editor` > `Viewer`).
- If `skip_org_role_sync = false` and no mappings result in at least one org role, login is rejected (reported as invalid credentials).
- If `skip_org_role_sync = true`, mappings are ignored for access control (user still logs in).

### Example with inline mapping

```ini
[auth.radius]
enabled = true
server = radius.company.internal
secret = $__env{RADIUS_SHARED_SECRET}
class_mappings = [{"class":"admins","orgId":1,"orgRole":"Admin","isGrafanaAdmin":true},{"class":"users","orgId":1,"orgRole":"Viewer"}]
```

### Testing mappings

Enable debug logging for the `radius` logger to see class values and mapping outcomes:

```ini
[log]
filters = radius:debug
```

Attempt a login and inspect the logs for extracted Class attributes and mapping decisions.

## Email construction

If the RADIUS username is not an email address (no `@`) and `email_suffix` is set, Grafana constructs the user's email as `username@<suffix>`. If the username already contains `@`, the suffix is ignored. Leading `@` in the suffix is optional.

Examples:
- `email_suffix = example.com`, username `alice` -> `alice@example.com`
- `email_suffix = @example.com`, username `bob` -> `bob@example.com`
- `email_suffix = example.com`, username `carol@example.net` -> `carol@example.net`

## Authentication flow

1. User submits username and password via the Grafana login form (or basic auth header if enabled).
2. Grafana constructs a RADIUS Access-Request with attributes `User-Name` and `User-Password` (encrypted with the shared secret) and sends it to `server:port`.
3. On Access-Accept:
   - All Class attributes are collected.
   - Email is derived (suffix applied if configured).
   - If role sync enabled, class mappings are applied; at least one org role must result.
4. On Access-Reject or any network/error/timeout, Grafana treats the credentials as invalid.
5. A local user record is created if `allow_sign_up = true` (first-time login) and provisioning rules are satisfied.

## Managing via SSO settings UI / API

RADIUS is also a configurable SSO provider (see Administration -> Authentication -> RADIUS) when included in `sso_settings.configurable_providers`. Fields exposed:
- enabled
- server, port, secret (secret write-only; UI indicates if configured)
- allow_sign_up
- skip_org_role_sync
- class_mappings (JSON array)
- radius_timeout_seconds
- email_suffix

Changes are hot-reloaded at runtime via the SSO settings service; no process restart is required when configured through the UI/API.

## Security considerations

| Aspect | Notes |
| ------ | ----- |
| Transport | This implementation sends UDP RADIUS requests; RadSec (TLS over TCP) is not currently supported. Consider network segmentation or a local RADIUS proxy if confidentiality of credentials in transit is a concern. |
| Shared secret | Treat `secret` as sensitive; store via environment variable or secrets manager, not directly in version control. |
| Password exposure | The RADIUS client uses the standard RADIUS User-Password hiding (MD5-based). Prefer running Grafana and the RADIUS server on a trusted network. |
| Replay / spoofing | Ensure the shared secret is strong and only known to Grafana and the RADIUS server. Limit source IPs on the RADIUS server. |
| Timeouts | Long timeouts can tie up login goroutines; keep `timeout_seconds` low (default 10). |
| Authorization gap | If `skip_org_role_sync=false` and mappings are misconfigured (no match), users cannot log in. Monitor logs for mapping failures. |
| Email suffix | Avoid setting a suffix that could collide with real external domains if usernames might equal existing email addresses. |

## Troubleshooting

| Symptom | Possible cause | Action |
| ------- | -------------- | ------ |
| Login always fails | Wrong `server`, `port`, `secret`, or network issue | Verify connectivity and shared secret; enable `radius:debug` logging. |
| Login succeeds but access denied | No class mappings matched and org role sync enabled | Add or correct `class_mappings`, or set `skip_org_role_sync=true` temporarily. |
| User gets no email | `email_suffix` unset and username lacks `@` | Configure `email_suffix`. |
| User not granted server admin | Mapping missing `isGrafanaAdmin:true` | Update the relevant mapping entry. |
| Changes in UI not applied | Using file config only | Ensure RADIUS is listed in `sso_settings.configurable_providers` or restart after file edits. |

## Logging

Enable detailed logs:

```ini
[log]
filters = radius:debug
```

Example debug messages:
- `Attempting RADIUS authentication` (with username)
- `RADIUS authentication successful`
- `No matching RADIUS class mappings found; denying login`

## Removal / migration

To disable RADIUS authentication, set `enabled = false` under `[auth.radius]` and restart (if using file-based config) or toggle it off in the Authentication UI. Users previously created remain; they can authenticate via other enabled methods if configured.

## Example full configuration block

```ini
[sso_settings]
configurable_providers = github gitlab google generic_oauth azuread okta radius

[auth.radius]
enabled = true
server = radius.internal.local
port = 1812
secret = $__file{/etc/secrets/radius_secret}
allow_sign_up = true
skip_org_role_sync = false
class_mappings = [{"class":"admins","orgId":1,"orgRole":"Admin","isGrafanaAdmin":true},{"class":"devs","orgId":1,"orgRole":"Editor"},{"class":"ops","orgId":2,"orgRole":"Viewer"}]
timeout_seconds = 8
email_suffix = example.com
```
