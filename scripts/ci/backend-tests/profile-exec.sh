#!/usr/bin/env bash
set -euo pipefail

bin="$1"
shift

rel="${PWD#"${PROFILE_REPO_ROOT:-$PWD}"/}"
safe="${rel//\//__}"
exec "$bin" "$@" -test.cpuprofile="$PROFILE_DIR/$safe.cpu.pprof" -test.memprofile="$PROFILE_DIR/$safe.mem.pprof"
