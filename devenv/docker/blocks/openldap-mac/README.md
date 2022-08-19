# OpenLDAP for MacOS Docker Block

This Docker block is an updated version from [OpenLDAP](../openldap/) block. This Docker block uses `osixia/openldap` image. The original Docker block was based of `debian:jessie` which is not available for Apple's ARM chip. 

## Deployment

First build and deploy the `openldap` container.

```bash
make devenv sources=openldap-mac
```

### Exposed ports

The container will expose port `389` and `636`.

### Background services

The `osixia/openldap` container will update the database with any `*.ldif` file changes inside `./prepopulate` and the `./modules` folder. Remember to rebuild the `devenv` to apply any changes.

## Grafana configuration changes

The following changes are needed at Grafana's configuration file.

```ini
[auth.ldap]
enabled = true
config_file = conf/ldap_dev.toml
```

The configuration between Grafana and the OpenLDAP container is configured at [./conf/ldap.toml](../../../../conf/ldap.toml).

## Available users and groups

- admins
  - ldap-admin
  - ldap-torkel
- backend
  - ldap-carl
  - ldap-torkel
  - ldap-leo
- frontend
  - ldap-torkel
  - ldap-tobias
  - ldap-daniel
- editors
  - ldap-editors
- no groups
  - ldap-viewer

## Groups & Users (POSIX)

- admins
  - ldap-posix-admin
- no groups
  - ldap-posix