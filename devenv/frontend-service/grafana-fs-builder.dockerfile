# Dockerfile.builder
FROM golang:1.24-bullseye

# Install C toolchains for the target (e.g., Linux on amd64)
RUN apt-get update && apt-get install -y \
    gcc libc6-dev jq

WORKDIR /builder

ENV CGO_ENABLED=1 \
    GOOS=linux \
    GOCACHE=/go-cache \
    GOMODCACHE=/go-mod-cache

RUN git config --global --add safe.directory /src