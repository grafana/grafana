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
go get -u github.com/mgechev/revive
go get -u github.com/securego/gosec/cmd/gosec/...
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
  --enable=ineffassign\
  --enable=structcheck\
  --enable=unconvert\
  --enable=varcheck

exit_if_fail go vet ./pkg/...

exit_if_fail revive -formatter stylish -config ./scripts/revive.toml

# TODO recheck the rules and leave only necessary exclusions
exit_if_fail gosec -quiet -exclude=G104,G107,G201,G202,G204,G301,G302,G304,G402,G501,G505,G401 ./pkg/...
