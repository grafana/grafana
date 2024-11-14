#!/bin/bash

cp Dockerfile ../../dist
cd ../../dist

docker build --tag "grafana/rpmtest" .

rm Dockerfile

docker run -i -t grafana/rpmtest /bin/bash
