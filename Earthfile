VERSION 0.6 

frontend-test:
    FROM node:16-alpine3.15

    ENV NODE_OPTIONS=--max_old_space_size=8000

    WORKDIR /grafana

    COPY --dir . ./

    RUN yarn install --immutable

    RUN yarn test-ci