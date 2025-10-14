FROM golang:1.25.2

ADD main.go /go/src/webhook/main.go

WORKDIR /go/src/webhook

RUN mkdir /tmp/logs
RUN go build -o /bin main.go

ENV PORT=8080

ENTRYPOINT [ "/bin/main" ]
