FROM golang:1.26.4

ADD main.go /go/src/webhook/main.go

WORKDIR /go/src/webhook

RUN mkdir /tmp/logs
RUN go build -o /bin main.go

RUN useradd -r -u 1001 -g root appuser && \
    chown appuser /tmp/logs /bin/main

ENV PORT=8080

USER appuser

ENTRYPOINT [ "/bin/main" ]
