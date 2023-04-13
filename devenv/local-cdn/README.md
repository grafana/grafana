# Local Grafana CDN

Use this docker container when working with the cdn_url config setting.

Set conf/custom.ini:

```
[server]
cdn_url = http://localhost:8080
```

then navigate to this directory and run:

`docker compose up -d`

Assets should now be available on `http://localhost:8080/grafana-oss/10.0.0-pre/public/*`
