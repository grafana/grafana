---
aliases:
  - ../../../auth/jwt/
description: Grafana JWT Authentication
labels:
  products:
    - enterprise
    - oss
menuTitle: JWT
title: Configure JWT authentication
weight: 1600
---

# Configure JWT authentication

You can configure Grafana to accept a JWT token provided in the HTTP header. The token is verified using any of the following:

- PEM-encoded key file
- JSON Web Key Set (JWKS) in a local file
- JWKS provided by the configured JWKS endpoint

This method of authentication is useful for integrating with other systems that
use JWKS but can't directly integrate with Grafana or if you want to use pass-through
authentication in an app embedding Grafana.

{{% admonition type="note" %}}
Grafana does not currently support refresh tokens.
{{% /admonition %}}

## Enable JWT

To use JWT authentication:

1. Enable JWT in the [main config file](../../../configure-grafana/).
1. Specify the header name that contains a token.

```ini
[auth.jwt]
# By default, auth.jwt is disabled.
enabled = true

# HTTP header to look into to get a JWT token.
header_name = X-JWT-Assertion
```

## Configure login claim

To identify the user, some of the claims needs to be selected as a login info. The subject claim called `"sub"` is mandatory and needs to identify the principal that is the subject of the JWT.

Typically, the subject claim called `"sub"` would be used as a login but it might also be set to some application specific claim.

```ini
# [auth.jwt]
# ...

# Specify a claim to use as a username to sign in.
username_claim = sub

# Specify a claim to use as an email to sign in.
email_claim = sub

# auto-create users if they are not already matched
# auto_sign_up = true
```

If `auto_sign_up` is enabled, then the `sub` claim is used as the "external Auth ID". The `name` claim is used as the user's full name if it is present.

Additionally, if the login username or the email claims are nested inside the JWT structure, you can specify the path to the attributes using the `username_attribute_path` and `email_attribute_path` configuration options using the JMESPath syntax.

JWT structure example.

```json
{
  "user": {
    "UID": "1234567890",
    "name": "John Doe",
    "username": "johndoe",
    "emails": ["personal@email.com", "professional@email.com"]
  }
}
```

```ini
# [auth.jwt]
# ...

# Specify a nested attribute to use as a username to sign in.
username_attribute_path = user.username # user's login is johndoe

# Specify a nested attribute to use as an email to sign in.
email_attribute_path = user.emails[1] # user's email is professional@email.com
```

## Iframe Embedding

If you want to embed Grafana in an iframe while maintaining user identity and role checks,
you can use JWT authentication to authenticate the iframe.

{{< admonition type="note" >}}
For Grafana Cloud, or scenarios where verifying viewer identity is not required,
embed [shared dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/share-dashboards-panels/shared-dashboards/).
{{< /admonition >}}

In this scenario, you will need to configure Grafana to accept a JWT
provided in the HTTP header and a reverse proxy should rewrite requests to the
Grafana instance to include the JWT in the request's headers.

{{< admonition type="note" >}}
For embedding to work, you must enable `allow_embedding` in the [security section](../../../configure-grafana/#allow_embedding). This setting is not available in Grafana Cloud.
{{< /admonition >}}

In a scenario where it is not possible to rewrite the request headers you
can use URL login instead.

### URL login

`url_login` allows grafana to search for a JWT in the URL query parameter
`auth_token` and use it as the authentication token.

{{< admonition type="note" >}}
You need to enable JWT before setting this setting. Refer to [Enabled JWT](#enable-jwt).
{{< /admonition >}}

{{< admonition type="warning" >}}
This can lead to JWTs being exposed in logs and possible session hijacking if the server is not
using HTTP over TLS.
{{< /admonition >}}

```ini
# [auth.jwt]
# ...
url_login = true # enable JWT authentication in the URL
```

An example of an URL for accessing grafana with JWT URL authentication is:

```
http://env.grafana.local/d/RciOKLR4z/board-identifier?orgId=1&kiosk&auth_token=eyJhbxxxxxxxxxxxxx
```

A sample repository using this authentication method is available
at [grafana-iframe-oauth-sample](https://github.com/grafana/grafana-iframe-oauth-sample).

## Signature verification

JSON web token integrity needs to be verified so cryptographic signature is used for this purpose. So we expect that every token must be signed with some known cryptographic key.

You have a variety of options on how to specify where the keys are located.

### Verify token using a JSON Web Key Set loaded from https endpoint

For more information on JWKS endpoints, refer to [Auth0 docs](https://auth0.com/docs/tokens/json-web-tokens/json-web-key-sets).

```ini
# [auth.jwt]
# ...

jwk_set_url = https://your-auth-provider.example.com/.well-known/jwks.json

# Cache TTL for data loaded from http endpoint.
cache_ttl = 60m
```

{{< admonition type="note" >}}
If the JWKS endpoint includes cache control headers and the value is less than the configured `cache_ttl`, then the cache control header value is used instead. If the `cache_ttl` is not set, no caching is performed. `no-store` and `no-cache` cache control headers are ignored.
{{< /admonition >}}

### Verify token using a JSON Web Key Set loaded from JSON file

Key set in the same format as in JWKS endpoint but located on disk.

```ini
jwk_set_file = /path/to/jwks.json
```

### Verify token using a single key loaded from PEM-encoded file

PEM-encoded key file in PKIX, PKCS #1, PKCS #8 or SEC 1 format.

```ini
key_file = /path/to/key.pem
```

If the JWT token's header specifies a `kid` (Key ID), then the Key ID must be set using the `key_id` configuration option.

```ini
key_id = my-key-id
```

## Validate claims

By default, only `"exp"`, `"nbf"` and `"iat"` claims are validated.

Consider validating that other claims match your expectations by using the `expect_claims` configuration option.
Token claims must match exactly the values set here.

```ini
# This can be seen as a required "subset" of a JWT Claims Set.
expect_claims = {"iss": "https://your-token-issuer", "your-custom-claim": "foo"}
```

## Roles

Grafana checks for the presence of a role using the [JMESPath](http://jmespath.org/examples.html) specified via the `role_attribute_path` configuration option. The JMESPath is applied to JWT token claims. The result after evaluation of the `role_attribute_path` JMESPath expression should be a valid Grafana role, for example, `None`, `Viewer`, `Editor` or `Admin`.

To assign the role to a specific organization include the `X-Grafana-Org-Id` header along with your JWT when making API requests to Grafana.
To learn more about the header, please refer to the [documentation](../../../../developers/http_api/#x-grafana-org-id-header).

### Configure role mapping

Unless `skip_org_role_sync` option is enabled, the user's role will be set to the role retrieved from the JWT.

The user's role is retrieved using a [JMESPath](http://jmespath.org/examples.html) expression from the `role_attribute_path` configuration option.
To map the server administrator role, use the `allow_assign_grafana_admin` configuration option.

If no valid role is found, the user is assigned the role specified by [the `auto_assign_org_role` option](../../../configure-grafana/#auto_assign_org_role).
You can disable this default role assignment by setting `role_attribute_strict = true`. This setting denies user access if no role or an invalid role is returned after evaluating the `role_attribute_path` and the `org_mapping` expressions.

You can use the `org_attribute_path` and `org_mapping` configuration options to assign the user to organizations and specify their role. For more information, refer to [Org roles mapping example](#org-roles-mapping-example). If both org role mapping (`org_mapping`) and the regular role mapping (`role_attribute_path`) are specified, then the user will get the highest of the two mapped roles.

To ease configuration of a proper JMESPath expression, go to [JMESPath](http://jmespath.org/) to test and evaluate expressions with custom payloads.

**Basic example:**

In the following example user will get `Editor` as role when authenticating. The value of the property `role` will be the resulting role if the role is a proper Grafana role, i.e. `None`, `Viewer`, `Editor` or `Admin`.

Payload:

```json
{
    ...
    "role": "Editor",
    ...
}
```

Configuration:

```ini
role_attribute_path = role
```

**Advanced example:**

In the following example user will get `Admin` as role when authenticating since it has a role `admin`. If a user has a role `editor` it will get `Editor` as role, otherwise `Viewer`.

Payload:

```json
{
    ...
    "info": {
        ...
        "roles": [
            "engineer",
            "admin",
        ],
        ...
    },
    ...
}
```

Configuration:

```ini
role_attribute_path = contains(info.roles[*], 'admin') && 'Admin' || contains(info.roles[*], 'editor') && 'Editor' || 'Viewer'
```

**Org roles mapping example**

In the following example, the , the user has been granted the role of a `Viewer` in the `org_foo` organization, and the role of an `Editor` in the `org_bar` and `org_baz` organizations.

Payload:

```json
{
    ...
    "info": {
        ...
        "orgs": [
            "engineer",
            "admin",
        ],
        ...
    },
    ...
}
```

Configuration:

```ini
org_attribute_path = info.orgs
org_mapping = engineer:org_foo:Viewer admin:org_bar:Editor *:org_baz:Editor
```

### Grafana Admin Role

If the `role_attribute_path` property returns a `GrafanaAdmin` role, Grafana Admin is not assigned by default, instead the `Admin` role is assigned. To allow `Grafana Admin` role to be assigned set `allow_assign_grafana_admin = true`.

### Skip organization role mapping

To skip the assignment of roles and permissions upon login via JWT and handle them via other mechanisms like the user interface, we can skip the organization role synchronization with the following configuration.

```ini
[auth.jwt]
# ...

skip_org_role_sync = true
```
