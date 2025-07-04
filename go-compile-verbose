#!/usr/bin/env bash

# Copyright Istio Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# This script runs can be used to emit (readable) compile tracing info when building go packages

# Before usage, `go clean -cache` is suggested, otherwise you will measure cached results.
# Cleanup: rm -f /tmp/golog; This will always append to the file so you should cleanup between each call.
# Usage (compile all tests only): `go test -exec=true -toolexec=$PWD/tools/go-compile-verbose ./...`
# Usage (compile binary): `go build -toolexec=$PWD/tools/go-compile-verbose ./...`
# Results will be in /tmp/golog, as stdout gets cached and pollutes all later runs.
START="$(date -u +%s.%N)"

# Output a message, with a timestamp matching istio log format
function log() {
  delta=$(date +%s.%N --date="$START seconds ago")
  echo -e "$(date -u '+%Y-%m-%dT%H:%M:%S.%NZ')\t${delta}\t$*" >&2 >> /tmp/golog
}

GROOT="$(go env GOROOT)"
GPATH="$(go env GOPATH)"
GMODCACHE="$(go env GOMODCACHE)"
ROOT="$PWD"

$@
ls="$(basename $1)"
shift
case "$ls" in
  link)
    log "${ls}\t$(basename ${2})" ;;
  compile)
    f=${@: -1}
    if [[ "$f" =~ "$GMODCACHE" ]]; then
      base="${f/"$GMODCACHE"\//}"
      mod="$(<<< "$base" cut -d@ -f1)"
      rest="$(<<< "$base" cut -d@ -f2 | cut -d/ -f2-)"
      log "${ls}\t${mod}\t${rest}"
    elif [[ "$f" =~ "$GROOT" ]]; then
        base="${f/"$GROOT"\//}"
        log "${ls}\tstd\t${base}"
    elif [[ "$f" =~ "$ROOT" ]]; then
        base="${f/"$ROOT"\//}"
        log "${ls}\tlocal\t${base}"
    else
        log "${ls}\tunknown\t${f}"
    fi
    ;;
  vet)
    # vet does not readily expose what is being vetted
    log "${ls}" ;;
  asm)
    f="${@:$#}"
    if [[ "$f" =~ "$GMODCACHE" ]]; then
      base="${f/"$GMODCACHE"\//}"
      mod="$(<<< "$base" cut -d@ -f1)"
      rest="$(<<< "$base" cut -d@ -f2 | cut -d/ -f2-)"
      log "${ls}\t${mod}\t${rest}"
    elif [[ "$f" =~ "$GROOT" ]]; then
        base="${f/"$GROOT"\//}"
        log "${ls}\tstd\t${base}"
    elif [[ "$f" =~ "$ROOT" ]]; then
        base="${f/"$ROOT"\//}"
        log "${ls}\tlocal\t${base}"
    else
        log "${ls}\tunknown\t${f}"
    fi
    ;;
  cgo)
    log "${ls}" ;;
  *)
    log "${ls}\t${@:-1}" ;;
esac
