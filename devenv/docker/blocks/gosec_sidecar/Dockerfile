FROM ghcr.io/securego/gosec:latest AS gosec

FROM golang:1.23-alpine

RUN apk add --no-cache git ca-certificates busybox-extras && \
    go install golang.org/x/vuln/cmd/govulncheck@latest

COPY --from=gosec /bin/gosec /usr/local/bin/gosec
COPY www/ /www/
RUN chmod +x /www/cgi-bin/scan.sh /www/cgi-bin/vuln.sh

EXPOSE 8080

CMD ["httpd", "-f", "-p", "8080", "-h", "/www"]
