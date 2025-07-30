ARG BASE_IMAGE=alpine:3.21
ARG GO_IMAGE=golang:1.24.5-alpine

# ----- Go build stage
FROM ${GO_IMAGE} AS go-dev-builder

RUN apk add --no-cache \
    binutils-gold \
    bash \
    gcc g++ make git jq findutils

WORKDIR /build-grafana

RUN go env GOCACHE
RUN go env GOPATH

# All files COPY'd here must be included in the `only` list in Tiltfile
# otherwise the image will not build with Tilt.

COPY Makefile devenv/frontend-service/build-grafana.sh ./

# Copy go mod files first
# run this command and replace the output below:
# find pkg scripts apps -type f \( -name go.mod -o -name go.sum \) -print | sed -E 's#(.*)/go\.(mod|sum)$#COPY \1/go.* \1/#' | sort -u
COPY apps/advisor/go.* apps/advisor/
COPY apps/alerting/notifications/go.* apps/alerting/notifications/
COPY apps/dashboard/go.* apps/dashboard/
COPY apps/folder/go.* apps/folder/
COPY apps/iam/go.* apps/iam/
COPY apps/investigations/go.* apps/investigations/
COPY apps/playlist/go.* apps/playlist/
COPY apps/secret/go.* apps/secret/
COPY pkg/aggregator/go.* pkg/aggregator/
COPY pkg/apimachinery/go.* pkg/apimachinery/
COPY pkg/apiserver/go.* pkg/apiserver/
COPY pkg/build/go.* pkg/build/
COPY pkg/build/wire/go.* pkg/build/wire/
COPY pkg/codegen/go.* pkg/codegen/
COPY pkg/plugins/codegen/go.* pkg/plugins/codegen/
COPY pkg/promlib/go.* pkg/promlib/
COPY pkg/semconv/go.* pkg/semconv/
COPY scripts/go-workspace/go.* scripts/go-workspace/
COPY scripts/modowners/go.* scripts/modowners/

COPY go.* ./

# Install dependencies
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download

# Copy source files
COPY kinds kinds
COPY kindsv2 kindsv2
COPY public/api-merged.json public/api-merged.json
COPY apps apps
COPY pkg pkg
COPY package.json package.json

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    bash build-grafana.sh


# ----- Runtime stage
FROM ${BASE_IMAGE}
RUN apk add --no-cache ca-certificates tzdata musl-utils bash

EXPOSE 3000

WORKDIR /grafana

RUN mkdir -p "conf/provisioning/datasources" \
"conf/provisioning/dashboards" \
"conf/provisioning/notifiers" \
"conf/provisioning/plugins" \
"conf/provisioning/access-control" \
"conf/provisioning/alerting"

# Copy config files
COPY conf/defaults.ini conf/ldap.toml conf/ldap_multiple.toml conf/

COPY public/emails public/emails
COPY public/views public/views
COPY public/dashboards public/dashboards

# Copy the Go binary from the go-dev-builder stage
COPY --from=go-dev-builder /build-grafana/bin/grafana /grafana/bin/grafana

COPY public/build/assets-manifest.json public/build/assets-manifest.json

ENTRYPOINT ["bin/grafana", "server"]
