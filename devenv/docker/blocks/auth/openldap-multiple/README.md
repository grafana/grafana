# OpenLDAP-Multiple Docker Block

This Docker block uses `osixia/openldap` image and should work for Apple's ARM chip.
Instead of launching solely 1 openldap server, it launches two.

## Deployment

First build and deploy the `openldap` containers.

```bash
make devenv sources=auth/openldap-multiple
```

### Exposed ports

The first container will expose port `389` and `636`.
The second container will expose port `1389` and `1636`.

### Background services

The `osixia/openldap` container will update the database with any `*.ldif` file changes inside `./prepopulate` and the `./modules` folder. Remember to rebuild the `devenv` to apply any changes.

## Grafana configuration changes

The following changes are needed at Grafana's configuration file.

```ini
[auth.ldap]
enabled = true
config_file = ./devenv/docker/blocks/auth/openldap-multiple/ldap_dev.toml
```

## Available users and groups

### Srv1 (dc=srv1-grafana,dc=org)

- admins
  - ldap-admin-srv1
- editors
  - ldap-editor-srv1
- no groups
  - ldap-viewer-srv1

## Srv2 (dc=srv2-grafana,dc=org)

- admins
  - ldap-admin-srv2
- editors
  - ldap-editor-srv2
- no groups
  - ldap-viewer-srv2
