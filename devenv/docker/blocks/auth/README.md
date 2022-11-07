# Auth Docker blocks

This collection of Docker images will help create a developer environment to
interact with different Authentication Providers.

## Usage

Spin up a service with the following command from the base directory of this
repository.

```bash
make devenv=oauth
```

This will add the `oauth/docker-compose` block to the `docker-compose` file used
by the `devenv` target.

## Available Authentication Providers

- [apache_proxy](./apache_proxy)
- [apache_proxy_mac](./apache_proxy_mac)
- [freeipa](./freeipa)
- [jwt_proxy](./jwt_proxy)
- [oauth](./oauth)
- [nginx_proxy](./nginx_proxy)
- [nginx_proxy_mac](./nginx_proxy_mac)
- [oauth](./oauth)
- [openldap](./openldap)
- [openldap-mac](./openldap-mac)
- [openldap-multiple](./openldap-multiple)
- [prometheus_basic_auth_proxy](./prometheus_basic_auth_proxy)
- [saml](./saml)
