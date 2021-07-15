+++
title = "Live HA setup"
description = "Grafana Live HA setup guide"
keywords = ["Grafana", "live", "guide", "ha"]
weight = 130
+++

# Configure Grafana Live HA setup

By default, Grafana Live uses in-memory data structures and in-memory PUB/SUB hub for handling subscriptions.

In HA Grafana setup which involves several Grafana server instances behind a load balancer you may come across the following limitations:

- Built-in features like dashboard change notifications will only be broadcasted to users connected to the same Grafana server process instance.
- Streaming from Telegraf will deliver data only to clients connected to the same instance which received Telegraf data, active stream cache is not shared between different Grafana instances.
- A separate unidirectional stream between Grafana and backend data source may be opened on different Grafana servers for the same channel.

To eliminate these limitations Grafana v8.1 introduced an experimental Live HA engine which requires Redis to work.

## Configure Redis Live engine

With Redis engine configured Grafana Live will keep its state in Redis and will use Redis PUB/SUB functionality to deliver messages to all subscribers throughout all Grafana server nodes.

Here is an example configuration:

```
[live]
ha_engine = redis
ha_engine_address = 127.0.0.1:6379
```

After running:

- All built-in real-time notifications like dashboard changes will be delivered to all Grafana server instances and broadcasted to all subscribers.
- Streaming from Telegraf will deliver messages to all subscribers
- A separate unidirectional stream between Grafana and backend data source will still be opened on different Grafana servers but publishing data to a channel will only deliver messages to instance subscribers thus publications from different instances on different machines won't result into duplicate data on panels.

At the moment we only support single Redis node.

> **Note:**  It's possible to use Redis Sentinel and Haproxy to achieve highly-available Redis setup. Redis nodes should be managed by [Redis Sentinel](https://redis.io/topics/sentinel) to achieve automatic failover. Haproxy configuration example:
> ```
> listen redis
>   server redis-01 127.0.0.1:6380 check port 6380 check inter 2s weight 1 inter 2s downinter 5s rise 10 fall 2 on-marked-down shutdown-sessions on-marked-up shutdown-backup-sessions
>   server redis-02 127.0.0.1:6381 check port 6381 check inter 2s weight 1 inter 2s downinter 5s rise 10 fall 2 backup
>   bind *:6379
>   mode tcp
>   option tcpka
>   option tcplog
>   option tcp-check
>   tcp-check send PING\r\n
>   tcp-check expect string +PONG
>   tcp-check send info\ replication\r\n
>   tcp-check expect string role:master
>   tcp-check send QUIT\r\n
>   tcp-check expect string +OK
>   balance roundrobin
> ```
> Then point Grafana Live to Haproxy address:port.
