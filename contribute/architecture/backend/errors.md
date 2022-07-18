# Errors

Grafana introduced its own error type `github.com/grafana/grafana/pkg/util/errutil.Error`
in June 2022. It's built on top of the Go `error` interface extended to
contain all the information necessary by Grafana to handle errors in an
informative and safe way.

Previously, Grafana has passed around regular Go errors and have had to
rely on bespoke solutions in API handlers to communicate informative
messages to the end-user. With the new `errutil.Error`, the API handlers
can be slimmed as information about public messaging, structured data
related to the error, localization metadata, log level, HTTP status
code, and so forth are carried by the error.

## Basic use

### Declaring errors

For a service, declare the different categories of errors that may occur
from your service (this corresponds to what you might want to have
specific public error messages or their templates for) by globally
constructing variables using the `errutil.NewBase(status, messageID, opts...)`
function.

The status code loosely corresponds to HTTP status codes and provides a
default log level for errors to ensure that the request logging is
properly informing administrators about various errors occurring in
Grafana (e.g. `StatusBadRequest` is generally speaking not as relevant
as `StatusInternal`). All available status codes live in the `errutil`
package and have names starting with `Status`.

The messageID is constructed as `<servicename>.<error-identifier>` where
the `<servicename>` corresponds to the root service directory per
[the package hierarchy](package-hierarchy.md) and `<error-identifier>`
is a short identifier using dashes for word separation that identifies
the specific category of errors within the service.

To set a static message sent to the client when the error occurs, the
`errutil.WithPublicMessage(message string)` option may be appended to
the NewBase function call. For dynamic messages or more options, refer
to the `errutil` package's GoDocs.

Errors are then constructed using the `Base.Errorf` method, which
functions like the [fmt.Errorf](https://pkg.go.dev/fmt#Errorf) method
except that it creates an `errutil.Error`.

```go
package main

import (
  "errors"
  "github.com/grafana/grafana/pkg/util/errutil"
  "example.org/thing"
)

var ErrBaseNotFound = errutil.NewBase(errutil.StatusNotFound, "main.not-found", errutil.WithPublicMessage("Thing not found"))

func Look(id int) (*Thing, error) {
  t, err := thing.GetByID(id)
  if errors.Is(err, thing.ErrNotFound) {
    return nil, ErrBaseNotFound.Errorf("did not find thing with ID %d: %w", id, err)
  }

  return t, nil
}
```

Check out [errutil's GoDocs](https://pkg.go.dev/github.com/grafana/grafana@v0.0.0-20220621133844-0f4fc1290421/pkg/util/errutil)
for details on how to construct and use Grafana style errors.

### Handling errors in the API

API handlers use the `github.com/grafana/grafana/pkg/api/response.Err`
function to create responses based on `errutil.Error`s.

> **Note:** (@sakjur 2022-06) `response.Err` requires all errors to be
> `errutil.Error` or it'll be considered an internal server error.
> This is something that should be fixed in the near future to allow
> fallback behavior to make it possible to correctly handle Grafana
> style errors if they're present but allow fallback to a reasonable
> default otherwise.
