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

echo "running redis and memcache tests"
#set -e
#time for d in $(go list ./pkg/...); do
time exit_if_fail go test -tags=redis ./pkg/infra/remotecache/...
time exit_if_fail go test -tags=memcached ./pkg/infra/remotecache/...
#done
