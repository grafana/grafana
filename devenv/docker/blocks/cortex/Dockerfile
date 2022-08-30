FROM ubuntu:22.04
# Config file taken from https://github.com/cortexproject/cortex/tree/master/docs/configuration/single-process-config-blocks-local.yaml
ADD cortex.yml /etc/config/
RUN mkdir /tmp/cortex/
RUN mkdir /tmp/cortex/rules

RUN apt-get install -f
RUN apt-get update
RUN apt-get install git -y
RUN apt-get install golang -y

RUN git clone https://github.com/cortexproject/cortex.git /etc/cortex
RUN cd /etc/cortex/ && go build ./cmd/cortex
RUN ./etc/cortex/cortex -config.file=/etc/config/cortex.yml > /tmp/cortex.tail.log &

#
RUN git clone https://github.com/prometheus/prometheus /etc/prometheus
RUN cd /etc/prometheus && go build ./cmd/prometheus
ADD prometheus.yml /etc/prometheus
RUN cd /etc/prometheus && ./prometheus --config.file=/etc/prometheus/prometheus.yml
