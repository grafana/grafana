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

Single Logout is now supported by authentik in versions `2023.1` and higher;

Source: <https://goauthentik.io/docs/releases/2023.1#new-features>

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
single_logout = true # supported by authentik v2023.1 and newer
signature_algorithm = rsa-sha256
allow_idp_initiated = true
org_mapping = admin:1:Admin, editor:1:Editor, viewer:1:Viewer
```

# SCIM with SAML

The devenv also configures a SCIM provider and application in Authentik that allows Grafana to synchronize users and groups. By default, it only synchronizes users that are members of the "SCIM Users" group in Authentik. However, it does not synchronize the group itself, so if you also would like to synchronize the group, you need to add it to the [Provisioned Groups](http://localhost:9000/if/admin/#/core/providers/4;%7B%22page%22%3A%22page-groups%22%7D) in the SCIM provider configuration in Authentik.

The provider is available [here](http://localhost:9000/if/admin/#/core/providers/4) and it uses "host.docker.internal:3000" to access Grafana from within the Authentik container. Make sure to update this if your Grafana instance is running elsewhere.

Before you start the synchronization, ensure that you have configured the service account token in the provider settings. Go to [Providers](http://localhost:9000/if/admin/#/core/providers), open the `grafana-scim` provider's settings, and set the Token field to the service account token you generated in Grafana for SCIM access.

To synchronize users from the `SCIM Users` group, you need to manually trigger the synchronization in Authentik. You can do this by navigating to the [SCIM provider page](http://localhost:9000/if/admin/#/core/providers/4) and on the `Schedules` panel you can find a `Full sync for SCIM provider` entry in the list. Click the play button to start the synchronization. It should synchronize all users from the `SCIM Users` group to Grafana.

You also need to setup Authentik SAML (above) for Grafana login to work for the synchronized users.

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
signout_redirect_url = http://localhost:9000/application/o/grafana-oidc/end-session/
```

## Available users and groups

_authentik admin_:

- username: akadmin
- email: admin@localhost
- password: admin

_grafana logins_:

- username: authentik-admin
- password: grafana

- username: authentik-editor
- password: grafana

- username: authentik-viewer
- password: grafana

- username: scim-user-1
- password: grafana

## Backing up DB

In case you want to make changes to the devenv setup, you can dump keycloak's DB:

```bash
cd devenv;
docker compose exec -T authentikdb bash -c "pg_dump -U authentik authentik" > docker/blocks/auth/authentik/cloak.sql
```
