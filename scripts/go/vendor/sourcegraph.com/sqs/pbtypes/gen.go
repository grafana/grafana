package pbtypes

//go:generate gopathexec protoc -I$GOPATH/src -I$GOPATH/src/github.com/gogo/protobuf/protobuf -I$GOPATH/src/github.com/gengo/grpc-gateway/third_party/googleapis -I. --gogo_out=. timestamp.proto void.proto html.proto
