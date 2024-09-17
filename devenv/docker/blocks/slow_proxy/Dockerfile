FROM golang:latest as builder
ADD main.go /
WORKDIR /
RUN go mod init proxy
RUN CGO_ENABLED=0 go build -o main .

FROM scratch
WORKDIR /
EXPOSE 3011
COPY --from=builder /main /main
ENTRYPOINT ["/main"]
