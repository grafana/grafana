---
aliases:
  - ../live/
  - ../live/configure-grafana-live/
  - ../live/live-channel/
  - ../live/live-feature-overview/
  - ../live/live-ha-setup/
  - ../live/set-up-grafana-live/
description: Grafana Live is a real-time messaging engine that pushes event data to
  a frontend when an event occurs.
labels:
  products:
    - enterprise
    - oss
menuTitle: Set up Grafana Live
title: Set up Grafana Live
weight: 1100
---

# Set up Grafana Live

Grafana Live is a real-time messaging engine you can use to push event data to a frontend as soon as an event occurs.

This could be notifications about dashboard changes, new frames for rendered data, and so on. Live features can help eliminate a page reload or polling in many places, it can stream Internet of things (IoT) sensors or any other real-time data to panels.

{{% admonition type="note" %}}
By `real-time`, we indicate a soft real-time. Due to network latencies, garbage collection cycles, and so on, the delay of a delivered message can be up to several hundred milliseconds or higher.
{{% /admonition %}}

## Concepts

Grafana Live sends data to clients over persistent WebSocket connection. Grafana frontend subscribes on channels to receive data which was published into that channel – in other words PUB/SUB mechanics is used. All subscriptions on a page multiplexed inside a single WebSocket connection. There are some rules regarding Live channel names – see [Grafana Live channel](#grafana-live-channel).

Handling persistent connections like WebSocket in scale may require operating system and infrastructure tuning. That's why by default Grafana Live supports 100 simultaneous connections max. For more details on how to tune this limit, refer to [Live configuration section](#configure-grafana-live).

## Features

Having a way to send data to clients in real-time opens a road for new ways of data interaction and visualization. Below we describe Grafana Live features supported at the moment.

### Dashboard change notifications

As soon as there is a change to the dashboard layout, it is automatically reflected on other devices connected to Grafana Live.

### Data streaming from plugins

With Grafana Live, backend data source plugins can stream updates to frontend panels.

For data source plugin channels, Grafana uses `ds` scope. Namespace in the case of data source channels is a data source unique ID (UID) which is issued by Grafana at the moment of data source creation. The path is a custom string that plugin authors free to choose themselves (just make sure it consists of allowed symbols).

For example, a data source channel looks like this: `ds/<DATASOURCE_UID>/<CUSTOM_PATH>`.

Refer to the tutorial about [building a streaming data source backend plugin](/tutorials/build-a-streaming-data-source-plugin/) for more details.

The basic streaming example included in Grafana core streams frames with some generated data to a panel. To look at it create a new panel and point it to the `-- Grafana --` data source. Next, choose `Live Measurements` and select the `plugin/testdata/random-20Hz-stream` channel.

### Data streaming from Telegraf

A new API endpoint `/api/live/push/:streamId` allows accepting metrics data in Influx format from Telegraf. These metrics are transformed into Grafana data frames and published to channels.

Refer to the tutorial about [streaming metrics from Telegraf to Grafana](/tutorials/stream-metrics-from-telegraf-to-grafana/) for more information.

## Grafana Live channel

Grafana Live is a PUB/SUB server, clients subscribe to channels to receive real-time updates published to those channels.

### Channel structure

Channel is a string identifier. In Grafana channel consists of 3 parts delimited by `/`:

- Scope
- Namespace
- Path

For example, the channel `grafana/dashboard/xyz` has the scope `grafana`, namespace `dashboard`, and path `xyz`.

Scope, namespace and path can only have ASCII alphanumeric symbols (A-Z, a-z, 0-9), `_` (underscore) and `-` (dash) at the moment. The path part can additionally have `/`, `.` and `=` symbols. The meaning of scope, namespace and path is context-specific.

The maximum length of a channel is 160 symbols.

Scope determines the purpose of a channel in Grafana. For example, for data source plugin channels Grafana uses `ds` scope. For built-in features like dashboard edit notifications Grafana uses `grafana` scope.

Namespace has a different meaning depending on scope. For example, for `grafana` scope this could be a name of built-in real-time feature like `dashboard` (i.e. dashboards events).

The path, which is the final part of a channel, usually contains the identifier of some concrete resource such as the ID of a dashboard that a user is currently looking at. But a path can be anything.

Channels are lightweight and ephemeral - they are created automatically on user subscription and removed as soon as last user left a channel.

### Data format

All data travelling over Live channels must be JSON-encoded.

## Configure Grafana Live

Grafana Live is enabled by default. In Grafana v8.0, it has a strict default for a maximum number of connections per Grafana server instance.

### Max number of connections

Grafana Live uses persistent connections (WebSocket at the moment) to deliver real-time updates to clients.

WebSocket is a persistent connection that starts with an HTTP Upgrade request (using the same HTTP port as the rest of Grafana) and then switches to a TCP mode where WebSocket frames can travel in both directions between a client and a server. Each logged-in user opens a WebSocket connection – one per browser tab.

The number of maximum WebSocket connections users can establish with Grafana is limited to 100 by default. See [max_connections](../configure-grafana/#max_connections) option.

In case you want to increase this limit, ensure that your server and infrastructure allow handling more connections. The following sections discuss several common problems which could happen when managing persistent connections, in particular WebSocket connections.

### Request origin check

To avoid hijacking of WebSocket connection Grafana Live checks the Origin request header sent by a client in an HTTP Upgrade request. Requests without Origin header pass through without any origin check.

By default, Live accepts connections with Origin header that matches configured [root_url](../configure-grafana/#root_url) (which is a public Grafana URL).

It is possible to provide a list of additional origin patterns to allow WebSocket connections from. This can be achieved using the [allowed_origins](../configure-grafana/#allowed_origins) option of Grafana Live configuration.

#### Resource usage

Each persistent connection costs some memory on a server. Typically, this should be about 50 KB per connection at this moment. Thus a server with 1 GB RAM is expected to handle about 20k connections max. Each active connection consumes additional CPU resources since the client and server send PING/PONG frames to each other to maintain a connection.

Using the streaming functionality results in additional CPU usage. The exact CPU resource utilization can be hard to estimate as it heavily depends on the Grafana Live usage pattern.

#### Open file limit

Each WebSocket connection costs a file descriptor on a server machine where Grafana runs. Most operating systems have a quite low default limit for the maximum number of descriptors that process can open.

To look at the current limit on Unix run:

```
ulimit -n
```

On a Linux system, you can also check out the current limits for a running process with:

```
cat /proc/<PROCESS_PID>/limits
```

The open files limit shows approximately how many user connections your server can currently handle.

To increase this limit, refer to [these instructions](https://docs.riak.com/riak/kv/2.2.3/using/performance/open-files-limit.1.html) for popular operating systems.

#### Ephemeral port exhaustion

Ephemeral port exhaustion problem can happen between your load balancer (or reverse proxy) software and Grafana server. For example, when you load balance requests/connections between different Grafana instances. If you connect directly to a single Grafana server instance, then you should not come across this issue.

The problem arises because each TCP connection uniquely identified in the OS by the 4-part-tuple:

```
source ip | source port | destination ip | destination port
```

By default, on load balancer/server boundary you are limited to 65535 possible variants. But actually, due to some OS limits (for example on Unix available ports defined in `ip_local_port_range` sysctl parameter) and sockets in TIME_WAIT state, the number is even less.

In order to eliminate a problem you can:

- Increase the ephemeral port range by tuning `ip_local_port_range` kernel option.
- Deploy more Grafana server instances to load balance across.
- Deploy more load balancer instances.
- Use virtual network interfaces.

#### WebSocket and proxies

Not all proxies can transparently proxy WebSocket connections by default. For example, if you are using Nginx before Grafana you need to configure WebSocket proxy like this:

```
http {
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    upstream grafana {
        server 127.0.0.1:3000;
    }

    server {
        listen 8000;

        location / {
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $http_host;
            proxy_pass http://grafana;
        }
    }
}
```

See the [Nginx blog on their website](https://www.nginx.com/blog/websocket-nginx/) for more information. Also, refer to your load balancer/reverse proxy documentation to find out more information on dealing with WebSocket connections.

Some corporate proxies can remove headers required to properly establish a WebSocket connection. In this case, you should tune intermediate proxies to not remove required headers. However, the better option is to use Grafana with TLS. Now WebSocket connection will inherit TLS and thus must be handled transparently by proxies.

Proxies like Nginx and Envoy have default limits on maximum number of connections which can be established. Make sure you have a reasonable limit for max number of incoming and outgoing connections in your proxy configuration.

## Configure Grafana Live HA setup

By default, Grafana Live uses in-memory data structures and in-memory PUB/SUB hub for handling subscriptions.

In a high availability Grafana setup involving several Grafana server instances behind a load balancer, you can find the following limitations:

- Built-in features like dashboard change notifications will only be broadcasted to users connected to the same Grafana server process instance.
- Streaming from Telegraf will deliver data only to clients connected to the same instance which received Telegraf data, active stream cache is not shared between different Grafana instances.
- A separate unidirectional stream between Grafana and backend data source may be opened on different Grafana servers for the same channel.

To bypass these limitations, Grafana v8.1 has an experimental Live HA engine that requires Redis to work.

### Configure Redis Live engine

When the Redis engine is configured, Grafana Live keeps its state in Redis and uses Redis PUB/SUB functionality to deliver messages to all subscribers throughout all Grafana server nodes.

Here is an example configuration:

```
[live]
ha_engine = redis
ha_engine_address = 127.0.0.1:6379
```

For additional information, refer to the [ha_engine](../configure-grafana/#ha_engine) and [ha_engine_address](../configure-grafana/#ha_engine_address) options.

After running:

- All built-in real-time notifications like dashboard changes are delivered to all Grafana server instances and broadcasted to all subscribers.
- Streaming from Telegraf delivers messages to all subscribers.
- A separate unidirectional stream between Grafana and backend data source opens on different Grafana servers. Publishing data to a channel delivers messages to instance subscribers, as a result, publications from different instances on different machines do not produce duplicate data on panels.

{{< admonition type="note" >}}
Live currently does not support Redis Sentinel. We recommend using a Redis Cluster for high-availability via a k8s helm chart such as the Bitnami Redis chart which has values to provision a Redis Cluster. Grafana Live can then be pointed to the `redis-headless` service.

```
 live:
   ha_engine: redis
   ha_engine_address: redis-headless.grafana.svc.cluster.local:6379
   ha_engine_password: $__file{/your/redis/password/secret/mount}
```

{{< /admonition >}}
