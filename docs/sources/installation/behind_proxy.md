+++
title = "Running Grafana behind a reverse proxy"
description = "Guide for running Grafana behind a reverse proxy"
keywords = ["grafana", "nginx", "documentation", "haproxy", "reverse"]
type = "docs"
[menu.docs]
name = "Running Grafana behind a reverse proxy"
parent = "tutorials"
weight = 1
+++


# Running Grafana behind a reverse proxy

It should be straight forward to get Grafana up and running behind a reverse proxy. But here are some things that you might run into.

Links and redirects will not be rendered correctly unless you set the server.domain setting.
```bash
[server]
domain = foo.bar
```

To use sub *path* ex `http://foo.bar/grafana` make sure to include `/grafana` in the end of root_url.
Otherwise Grafana will not behave correctly. See example below.

## Examples
Here are some example configurations for running Grafana behind a reverse proxy.

### Grafana configuration (ex http://foo.bar)

```bash
[server]
domain = foo.bar
```

### Nginx configuration

Nginx is a high performance load balancer, web server and reverse proxy: https://www.nginx.com/

#### Nginx configuration with HTTP and Reverse Proxy enabled
```bash
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html index.htm;

  location / {
   proxy_pass http://localhost:3000/;
  }
}
```

### Grafana configuration with hosting HTTPS in Nginx (ex https://foo.bar)

```bash
[server]
domain = foo.bar
root_url = https://foo.bar
```

#### Nginx configuration with HTTPS, Reverse Proxy, HTTP to HTTPS redirect and URL re-writes enabled

Instead of http://foo.bar:3000/?orgId=1, this configuration will redirect all HTTP requests to HTTPS and re-write the URL so that port 3000 isn't visible and will result in https://foo.bar/?orgId=1

```bash
server {
  listen 80;
  server_name foo.bar;
  return 301 https://foo.bar$request_uri;
}

server {
  listen 443 ssl http2;
  server_name foo.bar;
  root /usr/share/nginx/html;
  index index.html index.htm;
  ssl_certificate /etc/nginx/certs/foo_bar.crt;
  ssl_certificate_key /etc/nginx/certs/foo_bar_decrypted.key;
  ssl_protocols TLSv1.2;
  ssl_ciphers HIGH:!aNULL:!MD5;

  location / {
   rewrite /(.*) /$1  break;
   proxy_pass http://localhost:3000/;
   proxy_redirect off;
   proxy_set_header Host $host;
  }
}
```

### Examples with **sub path** (ex http://foo.bar/grafana)

#### Grafana configuration with sub path
```bash
[server]
domain = foo.bar
root_url = %(protocol)s://%(domain)s/grafana/
```

#### Nginx configuration with sub path
```bash
server {
  listen 80;
  root /usr/share/nginx/www;
  index index.html index.htm;

  location /grafana/ {
   proxy_pass http://localhost:3000/;
  }
}
```

#### HAProxy configuration with sub path
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

### IIS URL Rewrite Rule (Windows) with Subpath

IIS requires that the URL Rewrite module is installed.

Given:

- subpath `grafana`
- Grafana installed on `http://localhost:3000`
- server config:

    ```bash
    [server]
    domain = localhost:8080
    root_url = %(protocol)s://%(domain)s/grafana/
    ```

Create an Inbound Rule for the parent website (localhost:8080 in this example) in IIS Manager with the following settings:

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

See the [tutorial on IIS URL Rewrites](http://docs.grafana.org/tutorials/iis/) for more in-depth instructions.
