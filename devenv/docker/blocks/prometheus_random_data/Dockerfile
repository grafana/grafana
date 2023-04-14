# This Dockerfile builds an image for a client_golang example.

# Builder image, where we build the example.
FROM golang:1.17 AS builder
# Download prometheus/client_golang/examples/random first
RUN CGO_ENABLED=0 GOOS=linux go install -tags netgo -ldflags '-w' github.com/prometheus/client_golang/examples/random@v1.12.2

# Final image.
FROM scratch
LABEL maintainer "The Prometheus Authors <prometheus-developers@googlegroups.com>"
COPY --from=builder /go/bin/random .
EXPOSE 8080
ENTRYPOINT ["/random"]
