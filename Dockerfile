FROM golang:1.9
RUN go get -u github.com/golang/dep/cmd/dep
WORKDIR $GOPATH/src/github.com/grafana/grafana
COPY Gopkg.toml Gopkg.lock ./
RUN dep ensure --vendor-only
COPY pkg pkg
RUN go install ./pkg/cmd/grafana-server
RUN go install ./pkg/cmd/grafana-cli
RUN strip $GOPATH/bin/grafana-server
RUN strip $GOPATH/bin/grafana-cli

FROM node:8
WORKDIR /usr/src/app/
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
ENV NODE_ENV production
COPY . ./
RUN yarn run build

FROM debian:stretch-slim
WORKDIR /app
ENV PATH $PATH:/app/bin
COPY --from=0 /go/bin/grafana-server ./bin/
COPY --from=0 /go/bin/grafana-cli ./bin/
COPY --from=1 /usr/src/app/public ./public
COPY --from=1 /usr/src/app/tools ./tools
COPY conf ./conf
CMD ["grafana-server"]
