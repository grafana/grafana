#!/bin/bash

# Find the directory we exist within
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd ${DIR}
mkdir -p ${DIR}/artifacts

: ${GOPATH:="${HOME}/.go_workspace"}
: ${GOBIN:="${DIR}/build"}
: ${ORG_PATH:="github.com/grafana"}
: ${REPO_PATH:="${ORG_PATH}/grafana"}

export PATH=$GOPATH/bin:$PATH
export GOPATH GOBIN

cd ${GOPATH}/src/github.com/raintank/grafana

go run build.go package
cp dist/* ${DIR}/artifacts
