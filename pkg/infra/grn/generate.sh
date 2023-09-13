#!/bin/bash

# To compile all protobuf files in this repository, run
# "make protobuf" at the top-level.

set -eu

DST_DIR=./

SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ] ; do SOURCE="$(readlink "$SOURCE")"; done
DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"

cd "$DIR"

protoc \
  -I ./ \
  -I ../../../ \
  --go_out=${DST_DIR} \
  --go_opt=paths=source_relative \
  --go-grpc_out=${DST_DIR} \
  --go-grpc_opt=paths=source_relative \
  --go-grpc_opt=require_unimplemented_servers=false \
  *.proto
