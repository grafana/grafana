#!/bin/bash

# To compile all protobuf files in this repository, run
# "mage protobuf" at the top-level.

set -eu

#DST_DIR=../genproto/entity
DST_DIR=./

SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ] ; do SOURCE="$(readlink "$SOURCE")"; done
DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"

cd "$DIR"

protoc -I ./ \
  --go_out=${DST_DIR} \
  --go-grpc_out=${DST_DIR} --go-grpc_opt=require_unimplemented_servers=false \
  entity.proto
  