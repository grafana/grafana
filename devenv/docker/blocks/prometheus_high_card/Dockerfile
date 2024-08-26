FROM golang:latest AS builder




#COPY go.mod go.sum ./
# COPY *.go /
#COPY ./docker/blocks/prometheus_high_card/main.go ./

ADD main.go /
ADD go.mod /
ADD go.sum /
WORKDIR /

#RUN go mod init prometheus_high_card
RUN go mod download


#RUN go mod tidy
#RUN go mod download

# RUN GOOS=linux go install github.com/prometheus/client_golang/prometheus@latest
# RUN GOOS=linux go install github.com/prometheus/client_golang/prometheus/promauto@latest
# RUN GOOS=linux go install github.com/prometheus/client_golang/prometheus/promhttp@latest
# RUN go mod init prometheus_high_card


# RUN CGO_ENABLED=0 GOOS=linux go install github.com/prometheus/client_golang/prometheus@latest
# RUN CGO_ENABLED=0 GOOS=linux go install github.com/prometheus/client_golang/prometheus/promauto
# RUN CGO_ENABLED=0 GOOS=linux go install github.com/prometheus/client_golang/prometheus/promhttp
# RUN go mod init prometheus_high_card


RUN CGO_ENABLED=0 GOOS=linux go build -o main .

FROM scratch
WORKDIR /
EXPOSE 3012
COPY --from=builder /main /main
ENTRYPOINT ["/main"]
