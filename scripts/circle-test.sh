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


cd /home/ubuntu/.go_workspace/src/github.com/grafana/grafana

rm -rf node_modules
npm install -g npm
npm install

exit_if_fail npm test
exit_if_fail npm run coveralls

test -z "$(gofmt -s -l ./pkg/... | tee /dev/stderr)"

exit_if_fail go run build.go setup
exit_if_fail go run build.go build

exit_if_fail go vet ./pkg/...
exit_if_fail go test -v ./pkg/...


