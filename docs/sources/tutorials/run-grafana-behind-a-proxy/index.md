---
aliases:
  - /docs/grafana/latest/installation/behind_proxy/
authors:
  - grafana_labs
categories:
  - administration
description: Learn how to run Grafana behind a reverse proxy
id: run-grafana-behind-a-proxy
labels:
  products:
    - enterprise
    - oss
status: Published
summary: Learn how to run Grafana behind a reverse proxy
tags:
  - advanced
title: Run Grafana behind a reverse proxy
---

## Introduction

In this tutorial, you'll configure Grafana to run behind a reverse proxy.

When running Grafana behind a proxy, you need to configure the domain name to let Grafana know how to render links and redirects correctly.

- In the Grafana configuration file, change `server.domain` to the domain name you'll be using:

```bash
[server]
domain = example.com
```

- Restart Grafana for the changes to take effect.

## Configure reverse proxy

### Configure nginx

[nginx](https://www.nginx.com) is a high performance load balancer, web server, and reverse proxy.

- In your nginx configuration file inside the `http` section, add the following:

```nginx
# This is required to proxy Grafana Live WebSocket connections.
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
    proxy_set_header Host $host;
    proxy_pass http://grafana;
  }

  # Proxy Grafana Live WebSocket connections.
  location /api/live/ {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_pass http://grafana;
  }
}
```

- Reload the nginx configuration.
- Navigate to port 80 on the machine nginx is running on.
  You're greeted by the Grafana login page.

For Grafana Live which uses WebSocket connections you may have to raise the nginx value for [`worker_connections`](https://nginx.org/en/docs/ngx_core_module.html#worker_connections) option which is `512` by default. The default value limits the number of possible concurrent connections with Grafana Live.

Also, be aware that the preceding configuration only works when the `proxy_pass` value for `location /` is a literal string.
If you want to use a variable here, you must instead use [a rewrite rule](https://www.nginx.com/blog/creating-nginx-rewrite-rules/).
For more information, refer to [the GitHub issue #18299](https://github.com/grafana/grafana/issues/18299).

To configure nginx to serve Grafana under a _sub path_, update the `location` block:

```nginx
# This is required to proxy Grafana Live WebSocket connections.
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
    proxy_set_header Host $host;
    proxy_pass http://grafana;
  }

  # Proxy Grafana Live WebSocket connections.
  location /grafana/api/live/ {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_pass http://grafana;
  }
}
```

Add a rewrite rule to each location block:

```
 rewrite  ^/grafana/(.*)  /$1 break;
```

{{< admonition type="note" >}}
If nginx is performing TLS termination, then you must set the `root_url` and `protocol` configuration accordingly.
If you're serving Grafana from `https://example.com/grafana/` then the `root_url` is `https://example.com/grafana/` or `https://%(domain)s/grafana/` with the corresponding `domain` configuration value set to `example.com` in the `server` section of the Grafana configuration file.
Set `protocol` to `http`.
{{< /admonition >}}

### Configure HAProxy

To configure HAProxy to serve Grafana under a _sub path_:

```bash
frontend http-in
  bind *:80
  use_backend grafana_backend if { path /grafana } or { path_beg /grafana/ }

backend grafana_backend
  server grafana localhost:3000
  # Requires haproxy >= 1.6
  http-request set-path %[path,regsub(^/grafana/?,/)]
  # Works for haproxy < 1.6
  # reqrep ^([^\ ]*\ /)grafana[/]?(.*) \1\2

  server grafana localhost:3000
```

### Configure IIS

{{< admonition type="note" >}}
To use IIS, you must have the URL Rewrite module installed.
{{< /admonition >}}

To configure IIS to serve Grafana under a _sub path_, create an `Inbound Rule` for the parent website in **IIS Manager** with the following settings:

- pattern: `grafana(/)?(.*)`
- check the `Ignore case` checkbox
- rewrite URL set to `http://localhost:3000/{R:2}`
- check the `Append query string` checkbox
- check the `Stop processing of subsequent rules` checkbox

This is the rewrite rule that's generated in the `web.config`:

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

For more detailed instruction, refer to the [tutorial on IIS URL Rewrites](/tutorials/iis/).

### Configure Apache

To use Apache as a proxy, ensure its proper installation and configuration.

1.  Ensure that the Apache proxy module [`mod_proxy`](https://httpd.apache.org/docs/current/mod/mod_proxy.html) is installed and enabled. To enable, run the following commands:

```bash
a2enmod proxy
a2enmod proxy_http
```

2. To configure the proxy, edit the site configuration file. To do so, inside the `<VirtualHost>` section, add the following code:

```bash
  ProxyPreserveHost on
  ProxyPass / http://your_grafana_server:3000
  ProxyPassReverse / http://your_grafana_server:3000
```

3. Finally, restart Apache for the settings to take effect.

After you've restarted, navigate to your Apache server on port 80 and you will be redirected to Grafana.

To configure Grafana hosted in a sub path, replace the sub path with the following code (assuming your Grafana instance is on the sub path `your_path`):

```bash
  ProxyPreserveHost on
  ProxyPass /your_path http://your_grafana_server:3000
  ProxyPassReverse /your_path http://your_grafana_server:3000
  ProxyPass / http://your_grafana_server:3000/your_path
  ProxyPassReverse / http://192.168.250.5:3000/your_path
```

Note that the lines containing `your_path` _must_ come before the lines referencing root path (`/`) in order for this to work correctly.

### Configure Traefik

[Traefik](https://traefik.io/traefik/) Cloud Native application proxy.

Using the Docker provider and the following labels configures the router and service for a domain or subdomain routing.

```yaml
labels:
  traefik.http.routers.grafana.rule: Host(`grafana.example.com`)
  traefik.http.services.grafana.loadbalancer.server.port: 3000
```

To deploy on a _sub path_:

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

## Alternative for serving Grafana under a sub path

{{< admonition type="note" >}}
You only need this if you don't handle the sub path serving via your reverse proxy configuration.
{{< /admonition >}}

If you don't want or can't use the reverse proxy to handle serving Grafana from a _sub path_, you can set the configuration variable `server_from_sub_path` to `true`.

1. Include the sub path at the end of the `root_url`.
1. Set `serve_from_sub_path` to `true`:

```bash
[server]
domain = example.com
root_url = %(protocol)s://%(domain)s:%(http_port)s/grafana/
serve_from_sub_path = true
```
