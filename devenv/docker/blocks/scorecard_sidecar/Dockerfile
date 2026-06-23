FROM alpine:3.20 AS build

ARG SCORECARD_VERSION=5.5.0
ARG TARGETOS=linux
ARG TARGETARCH=amd64

RUN wget -qO /tmp/scorecard.tar.gz \
    "https://github.com/ossf/scorecard/releases/download/v${SCORECARD_VERSION}/scorecard_${SCORECARD_VERSION}_${TARGETOS}_${TARGETARCH}.tar.gz" \
  && tar -xzf /tmp/scorecard.tar.gz -C /tmp \
  && mv /tmp/scorecard /usr/local/bin/scorecard \
  && chmod +x /usr/local/bin/scorecard

FROM busybox:stable

COPY --from=build /usr/local/bin/scorecard /usr/local/bin/scorecard
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY www/ /www/

RUN chmod +x /www/cgi-bin/score.sh

EXPOSE 8080

CMD ["httpd", "-f", "-p", "8080", "-h", "/www"]
