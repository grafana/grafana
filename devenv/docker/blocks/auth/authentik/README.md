# Authentik block

Authentik is an open source idP that supports LDAP, SAML, OAuth.

Useful for testing a second implementation

## Currently configured in DB and instructions

- [x] LDAP
- [x] SAML
- [x] OAuth

## Deployment

First build and deploy the `openldap` container.

```bash
make devenv sources=auth/authentik
```

### Exposed ports

The container will expose port `3389` and `6636` as LDAP and LDAPS.

The container will expose port `9000` for API and Admin interface.


## LDAP Setup

The following changes are needed at Grafana's configuration file.

```ini
[auth.ldap]
enabled = true
config_file = devenv/docker/blocks/auth/authentik/ldap_authentik.toml

sync_cron = "* * * * 1"
active_sync_enabled = true
```

## SAML Setup

**Warning:** SLO

Grafana expects SLO support to be communicated in the metadata

Single Logout is not supported by authentik.
https://github.com/goauthentik/authentik/issues/3321 

**Warning** Client signature validation

Grafana expects the idP to retrieve the client's public key from the metadata.
Authentik does not seem to support this and therefore client signature verification is set
as optional.

```ini
[auth.saml]
enabled = true
certificate_path = devenv/docker/blocks/auth/authentik/cert.crt
private_key_path = devenv/docker/blocks/auth/authentik/key.pem
idp_metadata_url = http://localhost:9000/api/v3/providers/saml/2/metadata/?download
assertion_attribute_name = http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name
assertion_attribute_login = http://schemas.goauthentik.io/2021/02/saml/username
assertion_attribute_email = http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress
assertion_attribute_groups = http://schemas.xmlsoap.org/claims/Group
assertion_attribute_org = http://schemas.xmlsoap.org/claims/Group
allow_sign_up = true
single_logout = false # not supported by authentik
signature_algorithm = rsa-sha256
allow_idp_initiated = true
org_mapping = admin:1:Admin, editor:1:Editor, viewer:1:Viewer
```

# OAuth Setup

```ini
[auth.generic_oauth]
name = authentik
enabled = true
client_id = 43e8d2746fe2e508325a23cdf816d6ddd12e94f1
client_secret = e50440f14a010fd69dfed85bc6c071653f22c73e2c6c8d7ba96a936937d92040936b7e5a4bcc1bf40d5cf1dc019b1db327a1a00e2183c53471fb7530d4a09d7e
scopes = openid email profile
auth_url = http://localhost:9000/application/o/authorize/
token_url = http://localhost:9000/application/o/token/
api_url = http://localhost:9000/application/o/userinfo/
role_attribute_path = contains(groups[*], 'admin') && 'Admin' || contains(groups[*], 'editor') && 'Editor' || 'Viewer'

[auth]
signout_redirect_url = http://localhost:9000/application/o/grafana-oidc/end-session/
```

## Available users and groups

*authentik admin*: 

- username: akadmin
- email: admin@localhost
- password: admin

*grafana logins*:

- username: authentik-admin
- password: grafana

- username: authentik-editor
- password: grafana

- username: authentik-viewer
- password: grafana

## Backing up DB

In case you want to make changes to the devenv setup, you can dump keycloak's DB:

```bash
cd devenv;
docker-compose exec -T authentikdb bash -c "pg_dump -U authentik authentik" > docker/blocks/auth/authentik/cloak.sql
```