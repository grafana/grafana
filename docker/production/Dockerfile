FROM docker.hikvision.com.cn/prometheus/base:1.0

RUN mkdir -p /opt/grafana

ADD tmp/ /opt/grafana/

EXPOSE 3000

VOLUME ["/opt/grafana/data"]
VOLUME ["/opt/grafana/conf"]

WORKDIR /opt/grafana/
ENTRYPOINT ["./bin/grafana-server"]
