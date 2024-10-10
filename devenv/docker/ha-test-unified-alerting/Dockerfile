FROM golang:1.19

ADD webhook-listener.go /go/src/webhook/webhook-listener.go

WORKDIR /go/src/webhook

RUN mkdir /tmp/logs
RUN go build -o /bin webhook-listener.go

ENV PORT=8080

ENTRYPOINT [ "/bin/webhook-listener" ]
