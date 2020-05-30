FROM alpine:3.11

RUN apk add --no-cache curl bash

COPY entrypoint.sh /app/entrypoint.sh

ENTRYPOINT ["bash", "/app/entrypoint.sh"]
