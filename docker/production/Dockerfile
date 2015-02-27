FROM debian:jessie

RUN apt-get -y update
RUN apt-get -y install libfontconfig

RUN   mkdir -p /opt/grafana

ADD tmp/ /opt/grafana/

EXPOSE 3000

VOLUME ["/opt/grafana/data"]
VOLUME ["/opt/grafana/conf"]

WORKDIR /opt/grafana/
ENTRYPOINT ["./grafana", "web"]
