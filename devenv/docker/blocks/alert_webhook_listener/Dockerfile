
FROM golang:latest 
ADD main.go /
WORKDIR /
RUN go mod init alert_webhook_listener && go build -o main . 
EXPOSE 3010
RUN useradd -r -u 1001 -g root appuser
USER appuser
ENTRYPOINT ["/main"]
