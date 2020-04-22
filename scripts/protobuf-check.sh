#!/usr/bin/env bash

# Check whether protobuf & go plugin are installed
PROTOC_HELP_URL="http://google.github.io/proto-lens/installing-protoc.html"
PROTOC_GEN_GO_HELP_URL="https://github.com/golang/protobuf/tree/v1.3.4#installation"

EXIT_CODE=0

if ! [ -x "$(command -v protoc)" ]; then
	echo "Protocol Buffers not found."
	echo "Please install Protocol Buffers and ensure 'protoc' is available in your PATH."
	echo "See ${PROTOC_HELP_URL} for more."
	echo
	EXIT_CODE=1
fi

if ! [ -x "$(command -v protoc-gen-go)" ]; then
	echo "Protocol Buffers Go plugin not found."
	echo "Please install the plugin and ensure 'protoc-gen-go' is available in your PATH."
	echo "See ${PROTOC_GEN_GO_HELP_URL} for more."
	echo
	EXIT_CODE=1
fi

exit $EXIT_CODE