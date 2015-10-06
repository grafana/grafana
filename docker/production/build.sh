#!/bin/bash

cp Dockerfile ../../
cd ../../

go run build.go build

grunt release

docker build --tag "grafana/grafana:develop" .

rm Dockerfile
cd docker/production


