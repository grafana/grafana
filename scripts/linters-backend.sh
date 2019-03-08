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

go get -u github.com/alecthomas/gometalinter
go get -u honnef.co/go/tools/cmd/staticcheck

exit_if_fail gometalinter --enable-gc --vendor --deadline 10m --disable-all \
  --enable=staticcheck

go get -u github.com/golangci/golangci-lint/cmd/golangci-lint

exit_if_fail golangci-lint run --deadline 10m --disable-all \
  --enable=goconst\
  --enable=deadcode\
  --enable=gofmt\
  --enable=ineffassign\
  --enable=structcheck\
  --enable=unconvert\
  --enable=varcheck

exit_if_fail go vet ./pkg/...
