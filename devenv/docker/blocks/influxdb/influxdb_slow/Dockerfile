FROM golang:latest as builder
ADD main.go /
WORKDIR /
RUN GO111MODULE=off CGO_ENABLED=0 go build -o main .

FROM scratch
WORKDIR /
EXPOSE 8096
COPY --from=builder /main /main
CMD ["/main"]