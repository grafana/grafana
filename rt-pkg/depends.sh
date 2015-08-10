#!/bin/bash

# Find the directory we exist within
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd ${DIR}

: ${GOPATH:="${HOME}/.go_workspace"}
: ${ORG_PATH:="github.com/grafana"}
: ${REPO_PATH:="${ORG_PATH}/grafana"}

export GOPATH

mkdir -p artifacts
bundle install

echo "Linking ${GOPATH}/src/${REPO_PATH} to ${DIR}/../"
rm -fr ${GOPATH}/src/${REPO_PATH}
mkdir -p ${GOPATH}/src/${ORG_PATH}
ln -s ${DIR}/../ ${GOPATH}/src/${REPO_PATH}

go get github.com/tools/godep
