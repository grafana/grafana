#!/bin/bash

set -eu

DST_DIR=./

SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ] ; do SOURCE="$(readlink "$SOURCE")"; done
DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"

cd "$DIR"

protoc -I ./ \
  --go_out=${DST_DIR} \
  --go-grpc_out=${DST_DIR} --go-grpc_opt=require_unimplemented_servers=false \
  jwt.proto
  