FROM alpine
RUN apk update
RUN apk add rsync git bash yarn

COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/bin/bash", "/entrypoint.sh"]