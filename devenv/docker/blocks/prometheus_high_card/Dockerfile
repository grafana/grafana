FROM golang:latest as builder
ADD main.go /
WORKDIR /

RUN go mod init prometheus_high_card
#RUN CGO_ENABLED=0 GOOS=linux go install github.com/prometheus/client_golang/prometheus@latest
#RUN CGO_ENABLED=0 GOOS=linux go install github.com/prometheus/client_golang/prometheus/promauto@latest
#RUN CGO_ENABLED=0 GOOS=linux go install github.com/prometheus/client_golang/prometheus/promhttp@latest
RUN go get github.com/prometheus/client_golang/prometheus
RUN go get github.com/prometheus/client_golang/prometheus/promauto
RUN go get github.com/prometheus/client_golang/prometheus/promhttp

RUN CGO_ENABLED=0 GOOS=linux go build -o main .

FROM scratch
WORKDIR /
EXPOSE 3012
COPY --from=builder /main /main
ENTRYPOINT ["/main"]
