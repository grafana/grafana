# TLS Caddy Server

Starts a [Caddy server](https://caddyserver.com/) with TLS configured.

## Setup

- Caddy is setup to run on port 2081, so when configuring the webhook receiver in Grafana Alerting you should use the
  following the following URL: `https://localhost:2081`
- Also, Caddy is configured to use a self-signed certificate and to check the client certificate (`require_and_verify` mode)
- Caddy is setup to log requests and has debug mode enabled to make it easier to investigate possible issues

## TLS Certificates

If you want to configure a webhook contact point in Grafana Alerting with TLS, you need to provide a certificate and key.

You can find them in `/etc/caddy` directory in the container:

```shell
docker exec devenv-caddy_tls-1 ls /etc/caddy/
```

### CA Certificate

```shell
docker exec devenv-caddy_tls-1 cat /etc/caddy/ca.pem
```

### Client certificates

```shell
docker exec devenv-caddy_tls-1 cat /etc/caddy/client.pem
docker exec devenv-caddy_tls-1 cat /etc/caddy/client.key
```
