.PHONY: up down logs build-emitter run-emitter clean

# Start all services
up:
	docker compose up -d

# Stop all services
down:
	docker compose down -v

# View logs from all services
logs:
	docker compose logs -f

# View only auditlog server logs
logs-auditlog:
	docker compose logs -f auditlog

# View only alloy logs
logs-alloy:
	docker compose logs -f alloy

# Build the log emitter
build-emitter:
	cd logemitter && GOWORK=off go build -o logemitter .

# Run the log emitter (services must be running)
run-emitter: build-emitter
	cd logemitter && ./logemitter -endpoint localhost:4317 -interval 1000 -audit-ratio 0.3

# Run emitter with custom settings
# Usage: make run-emitter-custom INTERVAL=500 RATIO=0.5
run-emitter-custom: build-emitter
	cd logemitter && ./logemitter -endpoint localhost:4317 -interval $(or $(INTERVAL),1000) -audit-ratio $(or $(RATIO),0.3)

# Clean up
clean:
	docker compose down -v
	rm -f logemitter/logemitter

# Full test: start services, run emitter for a bit, then stop
test: up
	@echo "Waiting for services to start..."
	@sleep 5
	@echo "Running log emitter for 30 seconds..."
	@cd logemitter && GOWORK=off go build -o logemitter . && timeout 30 ./logemitter -endpoint localhost:4317 -interval 500 -audit-ratio 0.4 || true
	@echo ""
	@echo "Test complete. Check the logs with: make logs-auditlog"

