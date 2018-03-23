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
    root_url = %(protocol)s://%(domain)s:/grafana
    ```

Create an Inbound Rule for the parent website (localhost:8080 in this example) in IIS Manager with the following settings:

- pattern: `grafana(/)?(.*)`
- check the `Ignore case` checkbox
- rewrite url set to `http://localhost:3000/{R:2}`
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

See the [tutorial on IIS Url Rewrites](http://docs.grafana.org/tutorials/iis/) for more in-depth instructions.
