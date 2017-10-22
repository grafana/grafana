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
npm install -g yarn --quiet
yarn install --pure-lockfile --no-progress

exit_if_fail npm run test:coverage
exit_if_fail npm run build

# publish code coverage
echo "Publishing javascript code coverage"
bash <(curl -s https://codecov.io/bash) -cF javascript
rm -rf coverage
# npm install -g codecov
# codecov
# cat ./coverage/lcov.info | node ./node_modules/coveralls/bin/coveralls.js

echo "running go fmt"
exit_if_fail test -z "$(gofmt -s -l ./pkg | tee /dev/stderr)"

echo "running go vet"
exit_if_fail test -z "$(go vet ./pkg/... | tee /dev/stderr)"

echo "building binaries"
exit_if_fail go run build.go build

echo "running go test"

set -e
echo "" > coverage.txt

for d in $(go list ./pkg/...); do
  exit_if_fail go test -race -coverprofile=profile.out -covermode=atomic $d
  if [ -f profile.out ]; then
    cat profile.out >> coverage.txt
    rm profile.out
  fi
done

echo "Publishing go code coverage"
bash <(curl -s https://codecov.io/bash) -cF go
