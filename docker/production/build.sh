#!/bin/bash

cp Dockerfile ../../
cd ../../

go run build.go build

grunt release --force

docker build --tag "docker.hikvision.com.cn/prometheus/grafana:1.0" .

rm Dockerfile
cd docker/production


