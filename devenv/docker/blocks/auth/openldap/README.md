# OpenLDAP for MacOS Docker Block

This Docker block is an updated version from [OpenLDAP](../openldap/) block. This Docker block uses `osixia/openldap` image. The original Docker block was based of `debian:jessie` which is not available for Apple's ARM chip.

## Deployment

First build and deploy the `openldap` container.

```bash
make devenv sources=auth/openldap
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
config_file = conf/ldap.toml
```

The default configuration between Grafana and the OpenLDAP container is configured at [../../../../../conf/ldap.toml](../../../../../conf/ldap.toml).

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

## Configure LDAP with TLS

After the `openldap` container has been deployed, you have to copy the CA from the docker container:

```bash
# get the container ID
docker ps

docker cp CONTAINER-ID:"/container/service/:ssl-tools/assets/default-ca/default-ca.pem" devenv/docker/blocks/auth/openldap/certs
```

To configure TLS you need the following lines in the .toml file under the `[[servers]]` section:

```ini
tls_ciphers = ["TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384"]
min_tls_version = "TLS1.2"
ssl_skip_verify = true
root_ca_cert = "devenv/docker/blocks/auth/openldap/certs/default-ca.pem"
client_cert = "devenv/docker/blocks/auth/openldap/certs/ldap.crt"
client_key = "devenv/docker/blocks/auth/openldap/certs/ldap.key"
```

For simplicity, the same private key is shared between the server and the client. To generate your own private keys and certificates please follow this guide: https://enlook.wordpress.com/2015/09/30/howto-generate-certificate-for-openldap-and-using-it-for-certificate-authentication/.

- To connect over LDAPS include this config:

```ini
port = 636
use_ssl = true
start_tls = false
```

- To connect with STARTTLS use this config:

```ini
port = 389
use_ssl = true
start_tls = true
```
