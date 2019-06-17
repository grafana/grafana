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
go get -u github.com/jgautheron/goconst/cmd/goconst
go get -u honnef.co/go/tools/cmd/staticcheck
go get -u github.com/golangci/golangci-lint/cmd/golangci-lint

# use gometalinter when lints are not available in golangci or
# when gometalinter is better. Eg. goconst for gometalinter does not lint test files
# which is not desired.
exit_if_fail gometalinter --enable-gc --vendor --deadline 10m --disable-all \
  --enable=goconst\
  --enable=staticcheck

# use golangci-when possible
exit_if_fail golangci-lint run --deadline 10m --disable-all \
  --enable=deadcode\
  --enable=gofmt\
  --enable=gosimple\
  --enable=govet\
  --enable=ineffassign\
  --enable=structcheck\
  --enable=typecheck\
  --enable=unconvert\
  --enable=unused\
  --enable=varcheck

exit_if_fail go vet ./pkg/...

exit_if_fail make revive
exit_if_fail make revive-alerting
exit_if_fail make gosec
