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
go get -u github.com/tsenart/deadcode
go get -u github.com/jgautheron/goconst/cmd/goconst
go get -u github.com/gordonklaus/ineffassign
go get -u github.com/opennota/check/cmd/structcheck
go get -u github.com/mdempsky/unconvert
go get -u github.com/opennota/check/cmd/varcheck
go get -u honnef.co/go/tools/cmd/staticcheck
go get -u github.com/mgechev/revive
go get -u github.com/securego/gosec/cmd/gosec/...

exit_if_fail gometalinter --enable-gc --vendor --deadline 10m --disable-all \
  --enable=deadcode \
  --enable=goconst \
  --enable=gofmt \
  --enable=ineffassign \
  --enable=structcheck \
  --enable=unconvert \
  --enable=varcheck \
  --enable=staticcheck

exit_if_fail go vet ./pkg/...
exit_if_fail revive -formatter stylish -config ./conf/revive.toml

# TODO recheck the rules and leave only necessary exclusions
exit_if_fail gosec -quiet -exclude=G104,G107,G201,G202,G204,G301,G302,G304,G402,G501,G505,G401 ./pkg/...
