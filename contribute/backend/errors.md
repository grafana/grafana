# Errors

Grafana includes its own error type [github.com/grafana/grafana/pkg/util/errutil.Error](../../pkg/util/errutil/errors.go).
Introduced in June 2022, the type is built on top of the Go `error` interface.
It extends the interface to contain all the information necessary by Grafana to handle errors in an informative and safe way.

Previously, Grafana passed around regular Go errors and therefore had to
rely on bespoke solutions in API handlers to communicate informative
messages to the end-user. With the new `errutil.Error`, the API handlers
can be streamlined. The error carries information about public messaging,
structured data related to the error, localization metadata, log level,
HTTP status code, and so on.

## Declare errors

For a service, declare the different categories of errors that may occur
from your service (this corresponds to categories for which you might want
to have specific public error messages or templates).

Globally construct variables using the `errutil.<status>(status, messageID, opts...)
functions. For example:

- `errutil.NotFound(messageID, opts...)`
- `errutil.BadRequest(messageID, opts...)`
- `errutil.ValidationFailed(messageID, opts...)`
- `errutil.Internal(messageID, opts...)`
- `errutil.Timeout(messageID, opts...)`
- `errutil.Unauthorized(messageID, opts...)`
- `errutil.Forbidden(messageID, opts...)`
- `errutil.TooManyRequests(messageID, opts...)`
- `errutil.NotImplemented(messageID, opts...)`
- `errutil.ClientClosedRequest(messageID, opts...)`

The previous functions use `errutil.NewBase(status, messageID, opts...)` under the covers, and that function should in general only be used outside the `errutil` package for `errutil.StatusUnknown`. For example, you can use that function when there are no accurate status code available.

The status code loosely corresponds to HTTP status codes and provides a
default log level for errors.
The default log levels ensure that the request logging is properly informing administrators about various errors occurring in Grafana (for example, `StatusBadRequest` isn't usually as relevant as `StatusInternal`).
All available status codes live in the `errutil` package and have names starting with `Status`.

The `messageID` is constructed as `<servicename>.<errorIdentifier>` where
the `<servicename>` corresponds to the root service directory per
[the package hierarchy](package-hierarchy.md) and `<errorIdentifier>`
is a camelCased short identifier that identifies the specific category
of errors within the service.

Group errors together (that is, share `errutil.Base`) based on
their public-facing properties. A single `messageID` should represent a
translatable string and its metadata.
`_service.MissingRequiredFields_` and `_service.MessageTooLong_` are likely
to be two different errors that are both validation failures, as their
user-friendly expansions are likely different.
This is the maximization rule of declaring as many errors with `errutil.Error` as you need public message structures.

The other side of the coin is that even though such messages as
"user is rate limited", "user doesn't exist", "wrong username", and
"wrong password" are reasonable errors to distinguish internally,
for security reasons the end-user shouldn't be told which particular
error they struck. This means that they should share the same base (such
as _login.Failed_).
This is the minimization rule of grouping together distinct logged errors that provide the same information via the API.

To set a static message sent to the client when the error occurs, append the
`errutil.WithPublicMessage(message string)` option to
the `NewBase` function call. For dynamic messages or more options, refer
to the `errutil` package's GoDocs.

You can then construct errors using the `Base.Errorf` method, which
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

Errors are considered to be part of `errutil.Base` and
`errutil.Template`, and whatever errors are wrapped for the purposes of the
`errors.Is` function.a

Refer to the package and method documentation for
`github.com/grafana/grafana/pkg/util/errutil` for details on how to
construct and use Grafana style errors.
This documentation isn't readily available on `pkg.go.dev`, but it can be viewed using [godoc](https://go.dev/cmd/godoc/) from the Grafana directory.

## Error source

You can optionally specify an error source that describes an error's origin.
By default, it's `_server_` and means the error originates from within the application, for example, Grafana.
The `errutil.WithDownstream()` option may be appended to the `NewBase` function call to denote an error originates from a _downstream_ server or service.
The error source information is used in the API layer to distinguish between Grafana errors and non-Grafana errors. Error source information is given for use when instrumenting the application, allowing Grafana operators to define SLOs based on actual Grafana errors.

## Handle errors in the API

API handlers use the `github.com/grafana/grafana/pkg/api/response.Err`
or `github.com/grafana/grafana/pkg/api/response.ErrWithFallback`
(same signature as `response.Error`) function to create responses based
on `errutil.Error`.

> **Note:** Using `response.Err` requires all errors to be Grafana style errors.
