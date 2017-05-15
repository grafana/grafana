#!/bin/bash

current_time=$(date "+%Y.%m.%d-%H.%M.%S")
cd /go/src/github.com/wangy1931/grafana
git pull
go run build.go build
go run build.go package
scp /go/src/github.com/wangy1931/grafana/dist/cloudinsight-frontend-1.0.0.tar.gz root@172.17.0.1:/data/workspace/grafana/release/cloudinsight-frontend-1.0.0-$current_time.tar.gz