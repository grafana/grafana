# NanoMQ MQTT broker

Starts a [NanoMQ MQTT broker](https://nanomq.io/docs/en/latest/).

## Authentication

The broker is configured to use a simple username/password authentication.
See [./nanomq_pwd.conf](./nanomq_pwd.conf) for the default credentials.

## TLS Certificates

If you want to configure an MQTT contact point in Grafana Alerting with TLS, you need to provide a certificate and key.

You can find them in `/etc/certs` directory in the container:

```shell
docker exec devenv-mqtt-1 ls /etc/certs/
```

### CA Certificate

```shell
docker exec devenv-mqtt-1 cat /etc/certs/ca.pem
```

### Client certificates

```shell
docker exec devenv-mqtt-1 cat /etc/certs/client.pem
docker exec devenv-mqtt-1 cat /etc/certs/client.key
```
