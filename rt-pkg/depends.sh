#!/bin/bash

# Find the directory we exist within
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd ${DIR}

: ${GOPATH:="${HOME}/.go_workspace"}
: ${ORG_PATH:="github.com/grafana"}
: ${REPO_PATH:="${ORG_PATH}/grafana"}

mkdir -p artifacts
bundle install

rm -fr ${GOPATH}/src/${ORG_PATH}
ln -s ${DIR}/../ ${GOPATH}/src/${ORG_PATH}

go get github.com/tools/godep
