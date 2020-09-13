# This Dockerfile builds an image for a client_golang example.

# Builder image, where we build the example.
FROM golang:1.15.1 AS builder
# Download prometheus/client_golang/examples/random first
RUN go get github.com/prometheus/client_golang/examples/random
WORKDIR /go/src/github.com/prometheus/client_golang
WORKDIR /go/src/github.com/prometheus/client_golang/prometheus
RUN go get -d
WORKDIR /go/src/github.com/prometheus/client_golang/examples/random
RUN CGO_ENABLED=0 GOOS=linux go build -a -tags netgo -ldflags '-w'

# Final image.
FROM scratch
LABEL maintainer "The Prometheus Authors <prometheus-developers@googlegroups.com>"
COPY --from=builder /go/src/github.com/prometheus/client_golang/examples/random .
EXPOSE 8080
ENTRYPOINT ["/random"]
