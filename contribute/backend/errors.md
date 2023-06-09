# Errors

Grafana introduced its own error type [github.com/grafana/grafana/pkg/util/errutil.Error](../../pkg/util/errutil/errors.go)
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

The messageID is constructed as `<servicename>.<errorIdentifier>` where
the `<servicename>` corresponds to the root service directory per
[the package hierarchy](package-hierarchy.md) and `<errorIdentifier>`
is a camelCased short identifier that identifies the specific category
of errors within the service.

Errors should be grouped together (i.e. share `errutil.Base`) based on
their public facing properties, a single messageID should represent a
translatable string and what metadata is carried with it.
_service.MissingRequiredFields_ and _service.MessageTooLong_ are likely
to be two different errors that are both validation failures, as their
user-friendly expansions are likely different. This is the maximization
rule of declaring as many `errutil.Error`s as you need public message
structures.

The other side of this is that even though a login service's
"user is ratelimited", "user does not exist", "wrong username", and
"wrong password" are reasonable errors to separate between internally,
for security reasons the end-user should not be told which particular
error they struck. This means that they should share the same base (such
as _login.Failed_). This is the minimization rule of grouping together
distinct logged errors that provide the same information via the API.

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

var ErrBaseNotFound = errutil.NewBase(errutil.StatusNotFound, "main.notFound", errutil.WithPublicMessage("Thing not found"))

func Look(id int) (*Thing, error) {
  t, err := thing.GetByID(id)
  if errors.Is(err, thing.ErrNotFound) {
    return nil, ErrBaseNotFound.Errorf("did not find thing with ID %d: %w", id, err)
  }

  return t, nil
}
```

Errors consider themselves to be both its `errutil.Base` or
`errutil.Template` and whatever errors it wraps for the purposes of the
`errors.Is` function.

Check out the package and method documentation for
github.com/grafana/grafana/pkg/util/errutil for details on how to
construct and use Grafana style errors. This documentation is
unfortunately not readily available on pkg.go.dev because Grafana is not
fully Go modules compatible, but can be viewed using
[godoc](https://go.dev/cmd/godoc/) from the Grafana directory.

### Handling errors in the API

API handlers use the `github.com/grafana/grafana/pkg/api/response.Err`
or `github.com/grafana/grafana/pkg/api/response.ErrWithFallback`
(same signature as `response.Error`) function to create responses based
on `errutil.Error`.

Using `response.Err` requires all errors to be Grafana style errors.
