ARG GO_VERSION=1.12
FROM golang:${GO_VERSION}-alpine AS builder
RUN apk add --update --no-cache ca-certificates make git curl
RUN mkdir -p /build
WORKDIR /build
COPY . /build/
RUN go mod download
RUN make build-linux

FROM golang:${GO_VERSION}-alpine 
RUN apk add --update --no-cache ca-certificates git 
ENV GO111MODULE on
COPY --from=builder /build/gosec /bin/gosec
ENTRYPOINT ["/bin/gosec"]
