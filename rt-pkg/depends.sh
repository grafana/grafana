#!/bin/bash

# Find the directory we exist within
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd ${DIR}

: ${GOPATH:="${HOME}/.go_workspace"}
: ${ORG_PATH:="github.com/grafana"}
: ${REPO_PATH:="${ORG_PATH}/grafana"}

if [ ! -z ${CIRCLECI} ] ; then
  : ${CHECKOUT:="/home/ubuntu/${CIRCLE_PROJECT_REPONAME}"}
else
  : ${CHECKOUT:="${DIR}/.."}
fi

export GOPATH

mkdir -p artifacts
bundle install
sudo apt-get update
sudo apt-get install rpm

echo "CHECKOUT=${CHECKOUT}"

echo "Linking ${GOPATH}/src/${REPO_PATH} to ${CHECKOUT}"
mkdir -p ${GOPATH}/src/${ORG_PATH}
mkdir -p ${GOPATH}/src/github.com/raintank
ln -s ${CHECKOUT} ${GOPATH}/src/${REPO_PATH}
ln -s ${CHECKOUT} ${GOPATH}/src/github.com/raintank/grafana

go get github.com/tools/godep
npm install
npm install -g grunt-cli
