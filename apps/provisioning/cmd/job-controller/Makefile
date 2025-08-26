.PHONY: build clean test
BINARY_NAME=job-controller
BUILD_DIR=bin
LDFLAGS=-w -s

build:
	@echo "Building $(BINARY_NAME)..."
	@mkdir -p $(BUILD_DIR)
	go build -ldflags="$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY_NAME) .

clean:
	@echo "Cleaning..."
	@rm -rf $(BUILD_DIR)
run:
	@echo "Running $(BINARY_NAME)..."
	./$(BUILD_DIR)/$(BINARY_NAME)

install:
	@echo "Installing $(BINARY_NAME)..."
	go install .

help:
	@echo "Available targets:"
	@echo "  build   - Build the binary"
	@echo "  clean   - Clean build artifacts"
	@echo "  run     - Run the binary"
	@echo "  install - Install the binary"
	@echo "  help    - Show this help"
