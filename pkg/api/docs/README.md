# Build specification

The following command will build the API specification inside a docker container.

```bash
$ make spec
```

# Build specification on M1 Chip

The following command will build the API specification locally.If swagger is not already instaled, it will install it using [Homebrew](brew.sh).

```bash
$ make spec-mac
```

# Server specification

The following command will start grafana and swagger API editor serving the generated API specification. Grafana runs behind a nginx proxy for enabling CORS required by some browsers when trying routes via the UI `Try it out` button.

```bash
$ make openapi
```

Then, you can access the swagger API editor by navigating to `http://localhost:8080/`.

# Trying out the API

For trying the routes via the swagger API editor, you need to select the `HTTP` scheme.
For making authenticated requests, you need to set your API key or user credentials in `Authorize` modal.
