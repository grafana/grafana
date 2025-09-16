FROM golang:1.24-alpine AS builder

WORKDIR /build
COPY go.mod go.sum ./
COPY vendor* ./vendor
RUN test -f vendor/modules.txt || go mod download

COPY cmd cmd
COPY pkg pkg

RUN go build -o "target/operator" cmd/operator/*.go

FROM alpine AS runtime
COPY --from=builder /build/target/operator /usr/bin/operator

ENTRYPOINT ["/usr/bin/operator"]