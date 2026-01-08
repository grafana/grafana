# Prometheus behind an OAuth2-proxy

## How to setup OAuth2-proxy

1. Make a copy of `oauth2-proxy.example.cfg` and rename it to `oauth2-proxy.cfg`
1. Fill in the required information (`azure client id`, `azure client secret`, `azure tenant id`)
1. Start the containers by executing `make devenv sources="prometheus,auth/prometheus_oauth2_proxy_azure"`
   > If you would like to test the login flow from the browser then you need to setup TLS or start a tunnel. I usually use a tunnel (`cloudflared tunnel --url http://localhost:4180`). Do not forget to set the Redirect URIs on Azure's App Registration page

## How to add a new Prometheus datasource with Azure Authentication enabled

1. Navigate to Grafana and login
1. Add a new Prometheus datasource
1. On the new Prometheus datasource page
   1. Set the URL
   1. Enable Azure Authentication
   1. Fill in the required fields of the `Azure Authentication` section
   1. Click `Save & test`
   1. You should get a "Data source is working" message

If you check the logs of OAuth2-proxy, you should see similar lines to this:

```
2023-04-19 11:29:40 172.31.0.1:55602 - d96b832a-170a-41eb-a974-6558c5ce4454 - - [2023/04/19 09:29:40] some-random-tunnel-address.trycloudflare.com GET / "/api/v1/status/buildinfo" HTTP/1.1 "Grafana/10.0.0-pre" 200 187 0.016
2023-04-19 11:29:41 172.31.0.1:55602 - db27c56a-ccd6-4cdb-a040-318113781abf - 65ac87f4-931f-4e46-9761-f8bf1ad36b48 [2023/04/19 09:29:41] some-random-tunnel-address.trycloudflare.com POST / "/api/v1/query" HTTP/1.1 "Grafana/10.0.0-pre" 200 103 0.003
```
