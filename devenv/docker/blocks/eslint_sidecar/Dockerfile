FROM node:22-alpine AS build

RUN npm install -g eslint@9 eslint-plugin-security@4 @microsoft/eslint-plugin-sdl@1 @typescript-eslint/parser@8 @typescript-eslint/eslint-plugin@8

FROM node:22-alpine

RUN apk add --no-cache git ca-certificates busybox-extras

COPY --from=build /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=build /usr/local/bin/eslint /usr/local/bin/eslint

COPY www/ /www/
COPY eslint.config.js /www/eslint.config.js
RUN chmod +x /www/cgi-bin/scan.sh && \
    ln -s /usr/local/lib/node_modules /www/node_modules

EXPOSE 8080

CMD ["httpd", "-f", "-p", "8080", "-h", "/www"]
