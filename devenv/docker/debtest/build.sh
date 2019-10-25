#!/bin/bash

cp Dockerfile ../../dist
cd ../../dist

docker build --tag "grafana/debtest" .

rm Dockerfile

docker run -i -t grafana/debtest /bin/bash
