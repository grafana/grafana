By default this block is setup to scrape logs from /var/logs. If you need to log some service from the docker-compse you can add:
```
    # For this to work you need to install the logging driver see https://github.com/grafana/loki/tree/master/cmd/docker-driver#plugin-installation
    logging:
      driver: loki
      options:
        loki-url: "http://loki:3100/loki/api/v1/push"
```

This also works for self logging Loki logs if you use `http://localhost:3100/loki/api/v1/push`. This is useful together with  
```
    environment:
      - JAEGER_AGENT_HOST=tempo
      - JAEGER_AGENT_PORT=6831
      - JAEGER_SAMPLER_TYPE=const
      - JAEGER_SAMPLER_PARAM=1
```
which sets up a tracing and so you will have logs with traceIDs to test linking between logs and traces.
