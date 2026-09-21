FROM golang:1.26.6-alpine AS build
WORKDIR /src
COPY go.mod go.sum .
RUN go mod download
COPY main.go .
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/issuer .

FROM alpine:3.22
RUN apk add --no-cache su-exec && addgroup -S issuer && adduser -S -G issuer issuer && mkdir -p /app/data/keys && chown -R issuer:issuer /app/data
COPY --from=build /out/issuer /app/issuer
ENTRYPOINT ["/bin/sh", "-ec"]
CMD ["chown issuer:issuer /app/data/keys && exec su-exec issuer /app/issuer"]
