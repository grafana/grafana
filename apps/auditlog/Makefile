.PHONY: build run test clean

# Build the audit log server
build:
	go build -o bin/auditlog ./cmd/server

# Run the server
run: build
	./bin/auditlog

# Run tests
test:
	go test -v ./...

# Clean build artifacts
clean:
	rm -rf bin/

# Format code
fmt:
	go fmt ./...

# Lint code
lint:
	go vet ./...

