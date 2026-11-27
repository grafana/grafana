FROM golang:1.27.4-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY main.go ./
RUN CGO_ENABLED=0 go build -o /smoke .

FROM scratch
COPY --from=build /smoke /smoke
ENTRYPOINT ["/smoke"]
