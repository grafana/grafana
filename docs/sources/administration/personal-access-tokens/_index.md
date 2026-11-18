---
description: Create and manage personal access tokens that let a user authenticate scripts and tools with a subset of their own permissions
keywords:
  - personal access token
  - API
  - authentication
labels:
  products:
    - enterprise
    - oss
menuTitle: Personal access tokens
title: Personal access tokens
weight: 4250
---

# Personal access tokens

Personal access tokens (PATs) let a user call the Grafana HTTP API from scripts and tools without sharing their password. A token acts as its owner, limited to the scopes chosen when it was created.

{{< admonition type="note" >}}
Personal access tokens are experimental and disabled by default. Enable the `personalAccessTokens` feature toggle and set `enabled = true` in the `[personal_access_tokens]` configuration section.
{{< /admonition >}}

## Personal access tokens and service accounts

Use a service account for automation that should outlive any one person. Use a personal access token for work that is done on behalf of a specific user.

|             | Personal access token                                                    | Service account token                       |
| ----------- | ------------------------------------------------------------------------ | ------------------------------------------- |
| Identity    | The owning user                                                          | A non-human identity                        |
| Permissions | Owner's live permissions, intersected with the token scopes              | Permissions assigned to the service account |
| Lifetime    | Ends when the user is disabled, deleted or removed from the organization | Independent of any user                     |
| Created by  | Each user, for themselves                                                | Administrators                              |

## Create a token

1. Sign in and open **Profile**, then **Personal access tokens**.
1. Click **Add token**.
1. Enter a name, choose the scopes and an expiry date.
1. Click **Generate token** and copy the value. It starts with `glpat_` and is shown only once.

Send the token as a bearer token:

```bash
curl -H "Authorization: Bearer glpat_..." https://grafana.example.com/api/dashboards/home
```

## How permissions are evaluated

On every request Grafana loads the owner and evaluates their current permissions, then keeps only those that match the token scopes. A token can never do more than its owner can, and loses access immediately when the owner loses it.

Tokens cannot call sensitive endpoints, whatever scopes they have. These include changing the profile or password, managing tokens, sessions and login, and server-admin write actions and admin-level reads (listing or looking up other users, organizations, roles, server settings and stats, LDAP and SAML configuration, and the `users:read`, `users.permissions:read`, `roles:read`, `settings:read`, `org.users:read` and similar actions) unless `allow_admin_actions` is enabled. Even then, only tokens that name an admin action explicitly in their scopes (for example `users.tokens:create`, not a wildcard such as `*`) can use it, so tokens created before the setting was enabled never gain admin rights. Each explicit action lifts only the matching routes (for example `settings:read` allows reading server settings, not listing users), and a token never receives the owner's organization role or Grafana server admin flag, so routes that require those roles stay unavailable to tokens. Tokens also can't create or change playlists, short URLs, stars or other personal data endpoints, and on resources served through the Kubernetes-style storage layer (dashboards and folders) they only get the actions listed in their scopes; resource-scoped tokens are denied there.

## Token lifecycle

A token stops working when any of the following happens:

- It expires or is revoked by its owner or an administrator.
- The owner is disabled or deleted. Disabling a user revokes their tokens.
- The owner is removed from the token's organization.
- Personal access tokens are disabled for the instance or the organization.
- The owner's OAuth token refresh fails, which indicates that the identity provider session ended.
- The owner signs out of Grafana, if `revoke_on_idp_logout` is enabled.

### Limitations

Revocation on identity provider events covers failed OAuth token refreshes and, optionally, logout. A periodic revalidator (`idp_revalidate_interval`, default `1h`, `0` disables) revokes tokens of OAuth users whose provider session has expired and can't be refreshed; it never contacts the provider. Changing a user's password also revokes their tokens, and removal from an organization is covered by the org membership sync. Grafana has no OIDC back-channel logout endpoint, and SAML, LDAP and SCIM expose no per-user hook, so for these providers rely on short token lifetimes. Owners receive an email when a token is created or revoked if SMTP is configured.

### Rate limiting behind a reverse proxy

Failed token authentications are rate limited per client IP. By default the TCP peer address is used and forwarding headers are ignored, so behind a reverse proxy all clients share one bucket. To key on the real client address, set `trusted_proxies` to the IPs or CIDRs of your proxies and, if needed, `trusted_proxy_header` (default `X-Forwarded-For`). The header is only honored when the request comes from a trusted proxy, and the rightmost address that isn't a trusted proxy is used.

## Administer tokens

Server admins can manage tokens in **Administration** > **Users and access** > **Personal access tokens**. The page lists tokens with search, status and expiry filters, sorting, and a details view with a **Revoke** action. Server admins can search across all organizations. Users with `users.tokens:read` and `users.tokens:delete` can also list and revoke tokens for a user on the user's admin page.

The same page has the enable and disable switch for the whole instance and for the current organization. Disabling can optionally revoke existing tokens. The switch is read-only when the value is managed through configuration (`allow_runtime_override = false`).

Fixed roles:

| Role                       | Permissions                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `fixed:users.tokens:self`  | `users.tokens:create`, `users.tokens:read`, `users.tokens:delete` on the user's own tokens |
| `fixed:users.tokens:admin` | `users.tokens:read`, `users.tokens:delete` on all users in the organization                |

## Configuration

Settings in the `[personal_access_tokens]` section:

| Setting                  | Default | Description                                                 |
| ------------------------ | ------- | ----------------------------------------------------------- |
| `enabled`                | `false` | Enable personal access tokens. Requires the feature toggle. |
| `default_lifetime_days`  | `30`    | Lifetime used when no expiry is given.                      |
| `max_lifetime_days`      | `90`    | Maximum lifetime a token can be created with.               |
| `allow_no_expiry`        | `false` | Allow tokens that never expire.                             |
| `max_tokens_per_user`    | `10`    | Maximum active tokens per user.                             |
| `require_scopes`         | `false` | Require an explicit scope list.                             |
| `allow_admin_actions`    | `false` | Allow tokens to call server-admin write and read actions.   |
| `allow_runtime_override` | `true`  | Let server admins change the enabled switch at runtime.     |
| `revoke_on_idp_logout`   | `false` | Revoke an OAuth user's tokens when they sign out.           |

## HTTP API

| Method and path                                        | Description                                                                                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/user/tokens`                                 | List your tokens.                                                                                                                                |
| `POST /api/user/tokens`                                | Create a token. The secret is returned once.                                                                                                     |
| `DELETE /api/user/tokens/:uid`                         | Revoke one of your tokens.                                                                                                                       |
| `GET /api/user/tokens-policy`                          | Effective enabled state for you.                                                                                                                 |
| `GET /api/users/:id/tokens`                            | List a user's tokens in the organization.                                                                                                        |
| `DELETE /api/users/:id/tokens/:uid`                    | Revoke a user's token.                                                                                                                           |
| `GET /api/personal-access-tokens`                      | Search tokens. Parameters: `query`, `status`, `userId`, `expiringBefore`, `sort`, `order`, `page`, `perpage`, and `scope=all` for server admins. |
| `DELETE /api/personal-access-tokens/:uid`              | Revoke a token by UID.                                                                                                                           |
| `GET`/`PUT /api/org/settings/personal-access-tokens`   | Read or change the organization switch.                                                                                                          |
| `GET`/`PUT /api/admin/settings/personal-access-tokens` | Read or change the instance switch (server admin).                                                                                               |

Personal access tokens can't call the token management endpoints themselves; authenticate with a session or basic authentication.

## Security notes

- Only a SHA-256 hash of the token is stored; the secret can't be recovered.
- Tokens use the `glpat_` prefix so secret scanners can detect them.
- Authentication failures return a uniform error and token values are never written to logs.
- Treat a token like a password and revoke it if it may have leaked.
