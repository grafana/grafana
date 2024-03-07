#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail

rm -rf data/grafana-aggregator

mkdir -p data/grafana-aggregator
openssl req -nodes -new -x509 -keyout data/grafana-aggregator/ca.key -out data/grafana-aggregator/ca.crt
openssl req -out data/grafana-aggregator/client.csr -new -newkey rsa:4096 -nodes -keyout data/grafana-aggregator/client.key -subj "/CN=development/O=system:masters"
openssl x509 -req -days 365 -in data/grafana-aggregator/client.csr -CA data/grafana-aggregator/ca.crt -CAkey data/grafana-aggregator/ca.key -set_serial 01 -sha256 -out data/grafana-aggregator/client.crt
