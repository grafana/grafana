#!/bin/bash
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

echo "building backend with install to cache pkgs"
exit_if_fail time go install ./pkg/cmd/grafana-server

echo "running go test"
set -e
time for d in $(go list ./pkg/...); do
  exit_if_fail go test -tags=integration -covermode=atomic $d
done
