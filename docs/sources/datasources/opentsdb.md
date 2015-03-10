---
page_title: OpenTSDB Guide
page_description: OpenTSDB guide for Grafana
page_keywords: grafana, opentsdb, documentation
---

# OpenTSDB Guide

Here you will find some configuration tips for how to setup Grafana and OpenTSDB.

## OpenTSDB configuration

For OpenTSDB to work in Grafana you will either be needing to run the latest OpenTSDB
version built from the `next` branch that includes built in support for remote
api usage (CORS). This was merged into the next branch with [this issue](https://github.com/OpenTSDB/opentsdb/pull/333).

If you upgrade you have to set the OpenTSDB setting `tsd.http.request.cors_domains` to your
grafana webserver domain name.

If you do not want to upgrade OpenTSDB you need to setup an nginx proxy that will add the necessary CORS
HTTP headers.

Example nginx config:

Replace:

 - **OPENTSDB_HOST** (2 instances) - Hostname or IP address of the OpenTSDB server
 - **OPENTSDB_PORT** (1 instance) - Port number of the OpenTSDB server
 - **GRAFANA_DOMAIN** (1 instance) - Domain/Hostname of the Grafana server

```nginx
upstream opentsdb {
  server OPENTSDB_HOST:OPENTSDB_PORT fail_timeout=0;
}

server {
  listen *:4243;

  location / {
    # Regex to whitelist systems
    if ($http_origin ~* (https?://([a-z0-9._-]*\.)?GRAFANA_DOMAIN(:[0-9]+)?)) {
      set $cors "true";
    }

    # OPTIONS indicates a CORS pre-flight request
    if ($request_method = 'OPTIONS') {
      set $cors "${cors}-options";
    }

    # If it's OPTIONS, then it's a CORS preflight request so respond immediately with no response body
    if ($cors = "true-options") {
      add_header 'Access-Control-Allow-Origin' "$http_origin";
      add_header 'Access-Control-Allow-Credentials' 'true';
      add_header 'Access-Control-Max-Age' 1728000;
      add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
      add_header 'Access-Control-Allow-Headers' 'Authorization,Content-Type,Accept,Origin,User-Agent,DNT,Cache-Control,X-Mx-ReqToken,Keep-Alive,X-Requested-With,If-Modified-Since';
      add_header 'Content-Length' 0;
      add_header 'Content-Type' 'text/plain charset=UTF-8';
      return 204;
    }

    # Proxy the request
    proxy_set_header X-Host OPENTSDB_HOST;
    proxy_set_header X-Forwarded-For $Proxy_add_x_forwarded_for;
    proxy_set_header Authorization "";
    proxy_pass http://opentsdb;
    proxy_redirect default;
    proxy_buffer_size 16k;
    proxy_buffers 8 32k;
    proxy_busy_buffers_size 64k;
    proxy_temp_file_write_size 64k;
    proxy_read_timeout 120;
    # Strip any OpenTSDB-generated CORS headers that overlap with our own
    proxy_hide_header 'Access-Control-Allow-Origin';
    proxy_hide_header 'Access-Control-Allow-Credentials';
    proxy_hide_header 'Access-Control-Allow-Headers';

    # if it's a GET or POST, set the standard CORS responses header
    if ($cors = "true") {
      # Add our own CORS headers
      add_header 'Access-Control-Allow-Origin' "$http_origin";
      add_header 'Access-Control-Allow-Credentials' 'true';
      add_header 'Access-Control-Allow-Headers' '*';
    }
  }
}
```

## Grafana config
In config.js specify your opentsdb datasource:

```javascript
datasources: {
  'OpenTSDB-TEST': {
  	default: true,
    type: 'opentsdb',
    url: "http://my_opentsdb_server:4242"
  }
 },
```

## Create a graph
Open a graph in edit mode by click the title.

![](/img/opentsdb/editor_v1.png)

For details on opentsdb metric queries
checkout the offical [OpenTSDB documentation](http://opentsdb.net/docs/build/html/index.html)





