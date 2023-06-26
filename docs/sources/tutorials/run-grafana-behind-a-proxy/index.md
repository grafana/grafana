---
title: Run Grafana behind a reverse proxy
summary: Learn how to run Grafana behind a reverse proxy
description: Learn how to run Grafana behind a reverse proxy
id: run-grafana-behind-a-proxy
categories: ['administration']
tags: ['advanced']
status: Published
authors: ['grafana_labs']
Feedback Link: https://github.com/grafana/tutorials/issues/new
aliases: ['/docs/grafana/latest/installation/behind_proxy/']
---

## Introduction

In this tutorial, you'll configure Grafana to run behind a reverse proxy.

When running Grafana behind a proxy, you need to configure the domain name to let Grafana know how to render links and redirects correctly.

- In the Grafana configuration file, change `server.domain` to the domain name you'll be using:

```bash
[server]
domain = example.com
```

- Restart Grafana for the new changes to take effect.

You can also serve Grafana behind a _sub path_, such as `http://example.com/grafana`.

To serve Grafana behind a sub path:

- Include the sub path at the end of the `root_url`.
- Set `serve_from_sub_path` to `true`.

```bash
[server]
domain = example.com
root_url = %(protocol)s://%(domain)s:%(http_port)s/grafana/
serve_from_sub_path = true
```

Next, you need to configure your reverse proxy.

## Configure NGINX

[NGINX](https://www.nginx.com) is a high performance load balancer, web server, and reverse proxy.

- In your NGINX configuration file inside `http` section, add the following:

```nginx
# this is required to proxy Grafana Live WebSocket connections.
map $http_upgrade $connection_upgrade {
  default upgrade;
  '' close;
}

upstream grafana {
  server localhost:3000;
}

server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html index.htm;

  location / {
    proxy_set_header Host $http_host;
    proxy_pass http://grafana;
  }

# Proxy Grafana Live WebSocket connections.
  location /api/live/ {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $http_host;
    proxy_pass http://grafana;
  }
}
```

- Reload the NGINX configuration.
- Navigate to port 80 on the machine NGINX is running on. You're greeted by the Grafana login page.

For Grafana Live which uses WebSocket connections you may have to raise Nginx [worker_connections](https://nginx.org/en/docs/ngx_core_module.html#worker_connections) option which is 512 by default – which limits the number of possible concurrent connections with Grafana Live.

Also, be aware that the above configuration will work only when the `proxy_pass` value for `location /` is a literal string. If you are using a variable here, [read this GitHub issue](https://github.com/grafana/grafana/issues/18299). You will need to add [an appropriate NGINX rewrite rule](https://www.nginx.com/blog/creating-nginx-rewrite-rules/).

To configure NGINX to serve Grafana under a _sub path_, update the `location` block:

```nginx
# this is required to proxy Grafana Live WebSocket connections.
map $http_upgrade $connection_upgrade {
  default upgrade;
  '' close;
}

upstream grafana {
  server localhost:3000;
}

server {
  listen 80;
  root /usr/share/nginx/www;
  index index.html index.htm;

  location /grafana/ {
    proxy_set_header Host $http_host;
    proxy_pass http://grafana;
  }

  # Proxy Grafana Live WebSocket connections.
  location /grafana/api/live/ {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $http_host;
    proxy_pass http://grafana;
  }
}
```

If your Grafana configuration does not set `serve_from_sub_path` to true then you need to add a rewrite rule to each location block:

```
 rewrite  ^/grafana/(.*)  /$1 break;
```

## Configure HAProxy

To configure HAProxy to serve Grafana under a _sub path_:

```bash
frontend http-in
  bind *:80
  use_backend grafana_backend if { path /grafana } or { path_beg /grafana/ }

backend grafana_backend
  # Requires haproxy >= 1.6
  http-request set-path %[path,regsub(^/grafana/?,/)]

  # Works for haproxy < 1.6
  # reqrep ^([^\ ]*\ /)grafana[/]?(.*) \1\2

  server grafana localhost:3000
```

## Configure IIS

> IIS requires that the URL Rewrite module is installed.

To configure IIS to serve Grafana under a _sub path_, create an Inbound Rule for the parent website in IIS Manager with the following settings:

- pattern: `grafana(/)?(.*)`
- check the `Ignore case` checkbox
- rewrite URL set to `http://localhost:3000/{R:2}`
- check the `Append query string` checkbox
- check the `Stop processing of subsequent rules` checkbox

This is the rewrite rule that is generated in the `web.config`:

```xml
  <rewrite>
      <rules>
          <rule name="Grafana" enabled="true" stopProcessing="true">
              <match url="grafana(/)?(.*)" />
              <action type="Rewrite" url="http://localhost:3000/{R:2}" logRewrittenUrl="false" />
          </rule>
      </rules>
  </rewrite>
```

See the [tutorial on IIS URL Rewrites](/tutorials/iis/) for more in-depth instructions.

## Configure Traefik

[Traefik](https://traefik.io/traefik/) Cloud Native Reverse Proxy / Load Balancer / Edge Router

Using the docker provider the following labels will configure the router and service for a domain or subdomain routing.

```yaml
labels:
  traefik.http.routers.grafana.rule: Host(`grafana.example.com`)
  traefik.http.services.grafana.loadbalancer.server.port: 3000
```

To deploy on a _sub path_

```yaml
labels:
  traefik.http.routers.grafana.rule: Host(`example.com`) && PathPrefix(`/grafana`)
  traefik.http.services.grafana.loadbalancer.server.port: 3000
```

Examples using the file provider.

```yaml
http:
  routers:
    grafana:
      rule: Host(`grafana.example.com`)
      service: grafana
  services:
    grafana:
      loadBalancer:
        servers:
          - url: http://192.168.30.10:3000
```

```yaml
http:
  routers:
    grafana:
      rule: Host(`example.com`) && PathPrefix(`/grafana`)
      service: grafana
  services:
    grafana:
      loadBalancer:
        servers:
          - url: http://192.168.30.10:3000
```

## Summary

In this tutorial you learned how to run Grafana behind a reverse proxy.
