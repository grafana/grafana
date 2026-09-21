FROM golang:1.26.6-alpine AS build

WORKDIR /src
COPY pkg/apimachinery ./pkg/apimachinery
COPY apps/errortracking ./apps/errortracking
WORKDIR /src/apps/errortracking
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/error-tracking ./cmd/error-tracking

FROM alpine:3.22
RUN apk add --no-cache ca-certificates && addgroup -S errortracking && adduser -S -G errortracking errortracking
COPY --from=build /out/error-tracking /usr/local/bin/error-tracking
USER errortracking
ENTRYPOINT ["/usr/local/bin/error-tracking"]
