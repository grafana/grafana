.PHONY: test ci

%:      # stubs to get makefile param for `test-checker` command
	@:	# see: https://stackoverflow.com/a/6273809/433041

build:
	go build cmd/lintpack/build.go cmd/lintpack/main.go

test:
	go test -v -count=1 ./...

ci:
	go get -t -v ./...
	go test -v -count=1 ./...
