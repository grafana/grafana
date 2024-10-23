FROM caddy:2.8.4-alpine

WORKDIR /etc/caddy
EXPOSE 2081

COPY Caddyfile ./Caddyfile
COPY san.cnf ./san.cnf
COPY gen_certs.sh ./gen_certs.sh

RUN apk update && apk upgrade --no-cache && apk add openssl

RUN ./gen_certs.sh
