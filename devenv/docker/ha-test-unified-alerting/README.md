# Grafana Unified Alerting High Availability (HA) test setup

A set of docker compose services which together creates a Grafana HA test setup for unified alerting.

Included services

- Grafana
- Mysql - Grafana configuration database, exporter for metrics and session storage
- Prometheus - Monitoring of Grafana and used as data source
- Nginx - Reverse proxy for Grafana and Prometheus. Enables browsing Grafana/Prometheus UI using a hostname

## Prerequisites

### Build grafana docker container

Build a Grafana docker container from current branch and commit and tag it as grafana/grafana:dev.

```bash
$ cd <grafana repo>
$ make build-docker-full
```

### Virtual host names

#### Alternative 1 - Use dnsmasq

```bash
$ sudo apt-get install dnsmasq
$ echo 'address=/loc/127.0.0.1' | sudo tee /etc/dnsmasq.d/dnsmasq-loc.conf > /dev/null
$ sudo /etc/init.d/dnsmasq restart
$ ping whatever.loc
PING whatever.loc (127.0.0.1) 56(84) bytes of data.
64 bytes from localhost (127.0.0.1): icmp_seq=1 ttl=64 time=0.076 ms
--- whatever.loc ping statistics ---
1 packet transmitted, 1 received, 0% packet loss, time 1998ms
```

#### Alternative 2 - Manually update /etc/hosts

Update your `/etc/hosts` to be able to access Grafana and/or Prometheus UI using a hostname.

```bash
$ cat /etc/hosts
127.0.0.1       grafana.loc
127.0.0.1       prometheus.loc
```

## Start services

```bash
$ docker-compose up -d
```

Browse
- http://grafana.loc/
- http://prometheus.loc/


## Test alerting

### Create contact points
TBD
### Create alerts
TBD
### Create silences
TBD
