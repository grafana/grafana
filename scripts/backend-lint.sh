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

exit_if_fail make golangci-lint

exit_if_fail go vet ./pkg/...

exit_if_fail make revive
exit_if_fail make revive-alerting
exit_if_fail make gosec
