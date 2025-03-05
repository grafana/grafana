#!/usr/bin/env bash
# Copyright 2019 The Wire Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# https://coderwall.com/p/fkfaqq/safer-bash-scripts-with-set-euxo-pipefail
set -euo pipefail

if [[ $# -gt 0 ]]; then
  echo "usage: runtests.sh" 1>&2
  exit 64
fi

# Run Go tests. Only do coverage for the Linux build
# because it is slow, and codecov will only save the last one anyway.
result=0
if [[ "${RUNNER_OS:-}" == "Linux" ]]; then
  echo "Running Go tests (with coverage)..."
  go test -mod=readonly -race -coverpkg=./... -coverprofile=coverage.out ./... || result=1
  if [ -f coverage.out ] && [ $result -eq 0 ]; then
    bash <(curl -s https://codecov.io/bash)
  fi
else
  echo "Running Go tests..."
  go test -mod=readonly -race ./... || result=1
fi

# No need to run other checks on OSs other than linux.
# We default RUNNER_OS to "Linux" so that we don't abort here when run locally.
if [[ "${RUNNER_OS:-Linux}" != "Linux" ]]; then
  exit $result
fi

echo
echo "Ensuring .go files are formatted with gofmt -s..."
mapfile -t go_files < <(find . -name '*.go' -type f | grep -v testdata)
DIFF="$(gofmt -s -d "${go_files[@]}")"
if [ -n "$DIFF" ]; then
  echo "FAIL: please run gofmt -s and commit the result"
  echo "$DIFF";
  result=1;
else
  echo "OK"
fi;


# Ensure that the code has no extra dependencies (including transitive
# dependencies) that we're not already aware of by comparing with
# ./internal/alldeps
#
# Whenever project dependencies change, rerun ./internal/listdeps.sh
echo
echo "Ensuring that there are no dependencies not listed in ./internal/alldeps..."
(./internal/listdeps.sh | diff ./internal/alldeps - && echo "OK") || {
  echo "FAIL: dependencies changed; run: internal/listdeps.sh > internal/alldeps"
  # Module behavior may differ across versions.
  echo "using the latest go version."
  result=1
}


# For pull requests, check if there are undeclared incompatible API changes.
# Skip this if we're already going to fail since it is expensive.
# CURRENTLY BROKEN
# if [[ ${result} -eq 0 ]] && [[ ! -z "${GITHUB_HEAD_REF:-x}" ]]; then
  # echo
  # ./internal/check_api_change.sh || result=1;
# fi

exit $result
