#!/bin/bash

#
#   This script is executed from within the container.
#

echo "building enterprise version"

GOPATH=/go
REPO_PATH=$GOPATH/src/github.com/grafana/grafana


cd /go/src/github.com/grafana/grafana
echo "current dir: $(pwd)"

cd ..
git clone -b master --single-branch git@github.com:grafana/grafana-enterprise.git --depth 10
cd grafana-enterprise
#git checkout 7fbae9c1be3467c4a39cf6ad85278a6896ceb49f
./build.sh

cd ../grafana

function exit_if_fail {
    command=$@
    echo "Executing '$command'"
    eval $command
    rc=$?
    if [ $rc -ne 0 ]; then
        echo "'$command' returned $rc."
        exit $rc
    fi
}

exit_if_fail go test ./pkg/extensions/...


if [ "$CIRCLE_TAG" != "" ]; then
  echo "Building a release from tag $ls"
  go run build.go -buildNumber=${CIRCLE_BUILD_NUM} -enterprise=true -includeBuildNumber=false build
else
  echo "Building incremental build for $CIRCLE_BRANCH"
  go run build.go -buildNumber=${CIRCLE_BUILD_NUM} -enterprise=true build
fi

yarn install --pure-lockfile --no-progress

source /etc/profile.d/rvm.sh

echo "current dir: $(pwd)"

if [ "$CIRCLE_TAG" != "" ]; then
  echo "Packaging a release from tag $CIRCLE_TAG"
  go run build.go -buildNumber=${CIRCLE_BUILD_NUM} -enterprise=true -includeBuildNumber=false package latest
else
  echo "Packaging incremental build for $CIRCLE_BRANCH"
  go run build.go -buildNumber=${CIRCLE_BUILD_NUM} -enterprise=true package latest
fi
