FROM golang:latest AS builder

ADD main.go /
ADD go.mod /
ADD go.sum /
WORKDIR /

RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

FROM scratch
WORKDIR /
EXPOSE 9112
COPY --from=builder /main /main
ENTRYPOINT ["/main"]
