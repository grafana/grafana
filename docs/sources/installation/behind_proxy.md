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

### Grafana configuration (ex http://foo.bar.com)

```bash
[server]
domain = foo.bar
```

### Nginx configuration

```bash
server {
  listen 80;
  root /usr/share/nginx/www;
  index index.html index.htm;

  location / {
   proxy_pass http://localhost:3000/;
  }
}
```

### Examples with **sub path** (ex http://foo.bar.com/grafana)

#### Grafana configuration with sub path
```bash
[server]
domain = foo.bar
root_url = %(protocol)s://%(domain)s:/grafana
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


