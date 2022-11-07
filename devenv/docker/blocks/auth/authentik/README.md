# Authentik block

Authentik is an open source idP that supports LDAP, SAML, OAuth.

Useful for testing a second implementation

## Currently configured in DB and instructions

- [x] LDAP
- [ ] SAML
- [ ] OAuth

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