SRC_DIR=./proto
DST_DIR=./genproto

build-proto:
				protoc -I=${SRC_DIR} --go_out=plugins=grpc:${DST_DIR}/datasource/ ${SRC_DIR}/datasource.proto


.PHONY: proto
