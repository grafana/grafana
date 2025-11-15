# Build stage
FROM golang:1.25.3-alpine AS builder

# Set working directory
WORKDIR /app

# Install bash (required for update-workspace.sh) and build tools (required for CGO)
RUN apk add --no-cache bash build-base

# Copy source code
COPY ./apps ./apps
COPY ./pkg ./pkg
COPY ./conf ./conf
COPY ./go.mod ./go.mod
COPY ./go.sum ./go.sum
COPY ./go.work ./go.work
COPY ./go.work.sum ./go.work.sum
COPY ./build.go ./build.go
COPY ./package.json ./package.json

# Update workspace
COPY scripts/go-workspace/update-workspace.sh ./scripts/go-workspace/update-workspace.sh
RUN bash ./scripts/go-workspace/update-workspace.sh

# Build the application in dev mode to output binaries directly to ./bin/
RUN go run build.go -dev build-backend

# Final stage
FROM alpine:latest

# Install ca-certificates for HTTPS requests and wget for health checks
RUN apk --no-cache add ca-certificates tzdata wget

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Set working directory
WORKDIR /usr/share/grafana

# Copy all built binaries and conf from builder stage
COPY --from=builder /app/bin/ ./bin/
COPY --from=builder /app/conf/ ./conf/

# Create necessary directories and add binaries to PATH
RUN mkdir -p /etc/grafana-config && \
    chown -R appuser:appgroup /usr/share/grafana /etc/grafana-config

# Switch to non-root user
USER appuser

# Add binaries to PATH
ENV PATH="/usr/share/grafana/bin:${PATH}"

# Expose ports for metrics and profiling
EXPOSE 8080 6060

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/metrics || exit 1

# Run the application with the command from the YAML (can be overridden)
CMD ["grafana", "server", "target", "--config=/etc/grafana-config/operator.ini", "--homepath=/usr/share/grafana"]
