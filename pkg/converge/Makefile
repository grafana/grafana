.PHONY: test test-race cover lint fmt bench conformance

GO ?= GOWORK=off go

test:
	$(GO) test ./...

test-race:
	$(GO) test -race ./...

# The conformance suite is the contract. Run it wide before changing the planner.
conformance:
	$(GO) test ./conformance/ -count=1 -v -run Test

cover:
	$(GO) test -coverprofile=coverage.out ./...
	$(GO) tool cover -func=coverage.out | tail -1

fmt:
	gofmt -w .

lint:
	$(GO) vet ./...
	@test -z "$$(gofmt -l .)" || (echo "gofmt needed:"; gofmt -l .; exit 1)
