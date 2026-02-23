FROM nginx:1.29.0-alpine

RUN apk add --no-cache openssl curl ca-certificates

RUN printf "%s%s%s%s\n" \
    "@nginx " \
    "http://nginx.org/packages/mainline/alpine/v" \
    `egrep -o '^[0-9]+\.[0-9]+' /etc/alpine-release` \
    "/main" \
    | tee -a /etc/apk/repositories

RUN curl -o /tmp/nginx_signing.rsa.pub https://nginx.org/keys/nginx_signing.rsa.pub
RUN mv /tmp/nginx_signing.rsa.pub /etc/apk/keys/
RUN apk add --no-cache nginx-module-otel@nginx --force-overwrite

RUN sed -i '1iload_module modules/ngx_otel_module.so;' /etc/nginx/nginx.conf

COPY configs/nginx.conf /etc/nginx/conf.d/default.conf
