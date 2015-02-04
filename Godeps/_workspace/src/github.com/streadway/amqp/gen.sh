#!/bin/sh
go run spec/gen.go < spec/amqp0-9-1.stripped.extended.xml | gofmt > spec091.go
