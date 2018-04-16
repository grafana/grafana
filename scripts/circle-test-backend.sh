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

echo "running go fmt"
exit_if_fail test -z "$(gofmt -s -l ./pkg | tee /dev/stderr)"

echo "running go vet"
exit_if_fail test -z "$(go vet ./pkg/... | tee /dev/stderr)"

echo "building backend with install to cache pkgs"
exit_if_fail time go install ./pkg/cmd/grafana-server

echo "running go test"
go test ./pkg/...
