# This Dockerfile builds an image for a client_golang example.

# Builder image, where we build the example.
FROM golang:1.17 AS builder

# Install from full module source instead of `go install`, since that works despite the `exclude`
# directive in `go.mod` (https://github.com/golang/go/issues/44840)
RUN git clone --depth 1 https://github.com/prometheus/client_golang.git
RUN cd client_golang && CGO_ENABLED=0 GOOS=linux go install -tags netgo -ldflags '-w' ./examples/random

# Final image.
FROM scratch
LABEL maintainer "The Prometheus Authors <prometheus-developers@googlegroups.com>"
COPY --from=builder /go/bin/random .
EXPOSE 8080
ENTRYPOINT ["/random"]
