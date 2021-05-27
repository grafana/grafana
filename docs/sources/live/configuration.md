+++
title = "Configuration"
description = "Grafana Live configuration guide"
keywords = ["Grafana", "live", "guide", "websocket"]
weight = 120
+++

# Grafana Live configuration guide

Grafana Live is enabled by default, but as of Grafana v8 it has a strict default for maximum number of connections per Grafana server instance. 

## Max number of connections

Grafana Live uses persistent connections (WebSocket at the moment) to deliver real-time updates to clients. You may need to tune your server infrastructure a bit.

For this reason the number of maximum connections users can establish with Grafana is limited to 100:

```
[live]
# max_connections to Grafana Live WebSocket endpoint per Grafana server instance. See Grafana Live docs if you are
# going to make it higher than default 100 since this can require some OS and infrastructure tuning.
max_connections = 100
```

Before making this limit higher make sure your server and infrastructure allow handling more connections. Below we collected a number of common problems which could happen when managing persistent connections, in particular WebSocket connections.

### WebSocket

Grafana Live uses WebSocket protocol to deliver real-time updates to a frontend application. WebSocket is a persistent connection which starts with HTTP Upgrade request (using the same HTTP port as the rest of Grafana) and then switches to a TCP mode where WebSocket frames can travel in both directions between a client and a server.

Each logged-in user opens a WebSocket connection – one per browser tab.

Introducing a persistent connection leads to some things Grafana users should be aware of.

### Resource usage

Each persistent connection will cost some memory on a server. Typically, this should be about 50 KB per connection at this moment. Thus a server with 1 GB RAM is expected to handle about 20k connections max. Each active connection consumes an additional CPU resources since client and server send PING/PONG frames to each other to maintain a connection.

Of course, it will cost additional CPU as soon as streaming functionality is used. The exact CPU resource utilization is hard to estimate since it heavily depends on Grafana Live usage pattern.

### Open file limit

Each WebSocket connection costs a file descriptor on a server machine where Grafana runs. Most operating systems has a quite low default limit for the maximum number of descriptors that process can open.

To look at the current limit on Unix run:

```
ulimit -n
```

On a Linux system you can also check out the current limits for a running process with:

```
cat /proc/<PROCESS_PID>/limits
```

The open files limit shows approximately how many user connections your server can currently handle.

This limit can be increased – see for example [these instructions for popular operating systems](https://docs.riak.com/riak/kv/2.2.3/using/performance/open-files-limit.1.html).

### Ephemeral port exhaustion

Ephemeral ports exhaustion problem can happen between your load balancer (or reverse proxy) software and Grafana server. I.e. when you load balance requests/connections between different Grafana instances. If users connect directly to a single Grafana server instance you should not come across this issue.

The problem arises due to the fact that each TCP connection uniquely identified in the OS by the 4-part-tuple:

```
source ip | source port | destination ip | destination port
```

On load balancer/server boundary you are limited in 65535 possible variants by default. But actually due to some OS limits (for example on Unix available ports defined in `ip_local_port_range` sysctl parameter) and sockets in TIME_WAIT state the number is even less.

In order to eliminate a problem you can:

* Increase the ephemeral port range by tuning `ip_local_port_range` kernel option
* Deploy more Grafana server instances to load balance across
* Deploy more load balancer instances
* Use virtual network interfaces

### WebSocket and proxies

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
            proxy_set_header Connection "Upgrade";
            proxy_set_header Host $http_host;
            proxy_pass http://grafana;
        }
    }
}
```

See [more information on Nginx web site](https://www.nginx.com/blog/websocket-nginx/). Refer to your load balancer/reverse proxy documentation to find out more information on dealing with WebSocket connections.

Some corporate proxies can remove headers required to properly establish WebSocket connection. In this case you should tune intermediate proxies to not remove required headers. But the better way may me using Grafana with TLS. In this case WebSocket connection will also inherit TLS and thus must be handled transparently by proxies.

Proxies like Nginx and Envoy have default limits on maximum number of connections which can be established. Make sure you have a reasonable limit for max number of incoming and outgoing connections in your proxy configuration.
