FROM golang:1.15.2-alpine3.12 AS go-builder

WORKDIR /app

COPY go.* *.go ./
RUN CGO_ENABLED=0 go build -o query-untriaged

FROM alpine:3.12

WORKDIR /app

COPY --from=go-builder /app/query-untriaged ./

ENTRYPOINT ["/app/query-untriaged"]
