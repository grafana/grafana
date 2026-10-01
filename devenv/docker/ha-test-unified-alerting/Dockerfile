FROM golang:1.27.1-alpine@sha256:8a5910f31396cd4d89662f56c68b3ae31d374308270a1c3bd96672ee5ed43414

ADD webhook-listener.go /go/src/webhook/webhook-listener.go

WORKDIR /go/src/webhook

RUN mkdir /tmp/logs
RUN go build -o /bin webhook-listener.go

ENV PORT=8080

ENTRYPOINT [ "/bin/webhook-listener" ]
