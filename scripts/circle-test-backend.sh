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

echo "building backend with install to cache pkgs"
exit_if_fail time go install ./pkg/cmd/grafana-server

echo "running go test"

set -e
echo "" > coverage.txt

time for d in $(go list ./pkg/...); do
  exit_if_fail go test -coverprofile=profile.out -covermode=atomic $d
  if [ -f profile.out ]; then
    cat profile.out >> coverage.txt
    rm profile.out
  fi
done

echo "Publishing go code coverage"
bash <(curl -s https://codecov.io/bash) -cF go
