# Instrumenting Grafana

This guide provides conventions and best practices for instrumenting Grafana using logs, metrics, and traces.

## Logs

Logs are files that record events, warnings and errors as they occur within a software environment. Most logs include contextual information, such as the time an event occurred and which user or endpoint was associated with it.

### Usage

Use the [pkg/infra/log](/pkg/infra/log/) package to create a named, structured logger. Example:

```go
import (
  "fmt"

  "github.com/grafana/grafana/pkg/infra/log"
)

logger := log.New("my-logger")
logger.Debug("Debug msg")
logger.Info("Info msg")
logger.Warning("Warning msg")
logger.Error("Error msg", "error", fmt.Errorf("BOOM"))
```

### Naming conventions

Name the logger using lowercase characters, for example, `log.New("my-logger")` using snake_case or kebab-case styling.

Prefix the logger name with an area name when using different loggers across a feature or related packages; for example, `log.New("plugin.loader")` and `log.New("plugin.client")`.

Start the log message with a capital letter, for example, `logger.Info("Hello world")` instead of `logger.Info("hello world")`. The log message should be an identifier for the log entry. Avoid parameterization in favor of key-value pairs for additional data.

To be consistent with Go identifiers, prefer using camelCase style when naming log keys; for example, `remoteAddr`.

Use the key `Error` when logging Go errors; for example, `logger.Error("Something failed", "error", fmt.Errorf("BOOM"))`.

### Validate and sanitize input coming from user input

If log messages or key/value pairs originate from user input they should be validated and sanitized.

Be careful not to expose any sensitive information in log messages; for example, secrets and credentials. It's easy to do this by mistake if you include a struct as a value.

### Log levels

When should you use each log level?

- **Debug:** Informational messages of high frequency, less-important messages during normal operations, or both.
- **Info:** Informational messages of low frequency, important messages, or both.
- **Warning:** Use warning messages sparingly. If used, messages should be actionable.
- **Error:** Error messages indicating some operation failed (with an error) and the program didn't have a way to handle the error.

### Contextual logging

Use a contextual logger to include additional key/value pairs attached to `context.Context`. For example, a `traceID`, used to allow correlating logs with traces, correlate logs with a common identifier, either or both.

You must [Enable tracing in Grafana](#enable-tracing-in-grafana) to get a `traceID`.

For example:

```go
import (
  "context"
  "fmt"

  "github.com/grafana/grafana/pkg/infra/log"
)

var logger = log.New("my-logger")

func doSomething(ctx context.Context) {
  ctxLogger := logger.FromContext(ctx)
  ctxLogger.Debug("Debug msg")
  ctxLogger.Info("Info msg")
  ctxLogger.Warning("Warning msg")
  ctxLogger.Error("Error msg", "error", fmt.Errorf("BOOM"))
}
```

### Enable certain log levels for certain loggers

You can enable certain log levels during development to make logging easier. For example, you can enable `debug` to allow certain loggers to minimize the generated log output and makes it easier to find things. Refer to [[log.filters]](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#filters) for information on how to to set different levels for specific loggers.

You can also configure multiple loggers. For example:

```ini
[log]
filters = rendering:debug \
          ; alerting.notifier:debug \
          oauth.generic_oauth:debug \
          ; oauth.okta:debug \
          ; tsdb.postgres:debug \
          ; tsdb.mssql:debug \
          ; provisioning.plugins:debug \
          ; provisioning:debug \
          ; provisioning.dashboard:debug \
          ; provisioning.datasources:debug \
          datasources:debug \
          data-proxy-log:debug
```

## Metrics

Metrics are quantifiable measurements that reflect the health and performance of applications or infrastructure.

Consider using metrics to provide real-time insight into the state of resources. If you want to know how responsive your application is or identify anomalies that could be early signs of a performance issue, metrics are a key source of visibility.

### Metric types

See [Prometheus metric types](https://prometheus.io/docs/concepts/metric_types/) for a list and description of the different metric types you can use and when to use them.

There are many possible types of metrics that can be tracked. One popular method for defining metrics is the [RED method](https://grafana.com/blog/2018/08/02/the-red-method-how-to-instrument-your-services/).

### Naming conventions

Use the namespace `grafana` to prefix any defined metric names with `grafana_`. This prefix makes it clear for operators that any metric named `grafana_*` belongs to Grafana.

Use snake_case style when naming metrics; for example, `http_request_duration_seconds` instead of `httpRequestDurationSeconds`.

Use snake_case style when naming labels; for example, `status_code` instead of `statusCode`.

If a metric type is a counter, name it with a `_total` suffix; for example, `http_requests_total`.

If a metric type is a histogram and you're measuring duration, name it with a `_<unit>` suffix; for example, `http_request_duration_seconds`.

If a metric type is a gauge, name it to denote that it's a value that can increase and decrease; for example, `http_request_in_flight`.

### Label values and high cardinality

Be careful with what label values you accept or add. Using or allowing too many label values could result in [high cardinality problems](https://grafana.com/blog/2022/02/15/what-are-cardinality-spikes-and-why-do-they-matter/).

If label values originate from user input they should be validated. Use `metricutil.SanitizeLabelName(<label value>)` from the `pkg/infra/metrics/metricutil` package to sanitize label names.

> **Important:** Only allow a pre-defined set of labels to minimize the risk of high cardinality problems. Be careful not to expose any sensitive information in label values such as secrets and credentials.

### Guarantee the existence of metrics

To guarantee the existence of metrics before any observations have happened, you can use the helper methods available in the `pkg/infra/metrics/metricutil` package.

### How to collect and visualize metrics locally

1. Ensure you have Docker installed and running on your machine.
1. Start Prometheus.

   ```bash
   make devenv sources=prometheus
   ```

1. Run Grafana, and then create a Prometheus data source if you do not have one yet. Set the server URL to `http://localhost:9090`, enable basic authentication, and enter the same authentication you have for local Grafana.
1. Use Grafana Explore or dashboards to query any exported Grafana metrics. You can also view them at `http://localhost:3000/metrics`.

## Traces

A distributed trace is data that tracks an application request as it flows through the various parts of an application. The trace records how long it takes each application component to process the request and pass the result to the next component. Traces can also identify which parts of the application trigger an error.

### Usage

Grafana uses [OpenTelemetry](https://opentelemetry.io/) for distributed tracing. For more information, you may also refer to [The OpenTelemetry documentation](https://opentelemetry.io/docs/instrumentation/go/manual/).

1. Import the otel package

   ```Go
   "go.opentelemetry.io/otel"
   ```

2. Initialize a package level tracer

   We don't want to change the provider signature for every service across Grafana, especially in a testing scenario. otel.Tracer gets the global tracer configured in `pkg/infra/tracing` and handles whether or not we use a noop when otel is disabled.

   Using the package location as the provided name allows us to determine where the trace is coming from in the event of a naming collision.

   ```Go
   var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/dashboards")
   ```

   For enterprise, refer to the enterprise repo

   ```Go
   var tracer = otel.Tracer("github.com/grafana/grafana-enterprise/src/pkg/extensions/accesscontrol")
   ```

3. Create a span

   Spans are connected via the context.Context named ctx by convention. Name your span according to `<package>.<function>`. In some cases, there is a folder inside a package with a name commonly used throughout the codebase. In that case use the form `<package>.<folder>.<function>`.

   It is important to match casing for each of these as it's common convention to have an internal and external functions with the same name.

   Be sure to always terminate your spans.

   ```Go
   ctx, span := tracer.Start(ctx, "dashboards.store.GetDashboardByUID")
   defer span.End()
   ```

4. Ensure spans are connected

   Grafana's api package uses `*contextmodel.ReqContext` to pass between api functions with context.Context as a field on the request.

   Given `func (hs *HTTPServer) isDashboardStarredByUser(c *contextmodel.ReqContext)`

   you can fetch the context via `c.Req.Context()`

   If you create a span, you need to ensure the new context is set on `ReqContext`

   ```Go
   ctx, span := tracer.Start(c.Req.Context(), "api.isDashboardStarredByUser")
   defer span.End()
   c.Req = c.Req.WithContext(ctx)
   ```

   If the function does not pass a `*contextmodel.ReqContext` to another function, do not set the `ctx`.

5. Spans with no children
   Often in the context of cpu bound work you want a context, but won't pass the child down. In this case use a blank identifier like any other variable and we will get appropriate timing from the span.

   ```Go
   _, span := tracer.Start(c.Req.Context(), "api.isDashboardStarredByUser")
   defer span.End()
   ```

6. Deciding when to create a span

   Only instrument functions that perform IO bound work like database calls or quantifiable cpu bound work. Simple wrappers in the service layer that make a call to the database should not be instrumented as they're just creating more data without giving us more insights.

   For example, the following function is performing business logic, but not doing a meaningful amount of work. In this case, ensure ctx is passed to the child function and perform the tracing in `pd.store.FindByAccessToken`

   ```Go
   func (pd *PublicDashboardServiceImpl) FindByAccessToken(ctx context.Context, accessToken string) (*PublicDashboard, error) {
     ctx, span := tracer.Start(ctx, "publicdashboards.FindByAccessToken")
     defer span.End()

     pubdash, err := pd.store.FindByAccessToken(ctx, accessToken)
     if err != nil {
         return nil, ErrInternalServerError.Errorf("FindByAccessToken: failed to find a public dashboard: %w", err)
       }
     if pubdash == nil {
         return nil, ErrPublicDashboardNotFound.Errorf("FindByAccessToken: Public dashboard not found accessToken: %s", accessToken)
       }
     return pubdash, nil
   }
   ```

7. Adding attributes for investigation

   It's often helpful understand the context of a span. To help with debugging we can add attributes to a span that tell us more about the state of the function. This is very helpful for cpu bound function. In the following example we're performing a cpu bound operation and adding an attribute to the span telling us the number of permissions that were passed into the function.

   Import the otel attributes and trace packages.

   ```Go
    "go.opentelemetry.io/otel/attribute"
    "go.opentelemetry.io/otel/trace"
   ```

   Add your attributes when creating the span.

   ```Go
   func GroupScopesByActionContext(ctx context.Context, permissions []Permission) map[string][]string {
     _, span := tracer.Start(ctx, "accesscontrol.GroupScopesByActionContext", trace.WithAttributes(
       attribute.Int("permissions_count", len(permissions)),
     ))
     defer span.End()

     m := make(map[string][]string)
     for i := range permissions {
       m[permissions[i].Action] = append(m[permissions[i].Action], permissions[i].Scope)
     }
      return m
   }
   ```

Complete example

```go
import (
   "fmt"

   "github.com/grafana/grafana/pkg/infra/tracing"
   "go.opentelemetry.io/otel/attribute"
   "go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/myservice")

func (s *MyService) Hello(ctx context.Context, name string) (string, error) {
   ctx, span := s.tracer.Start(ctx, "MyService.Hello", trace.WithAttributes(
      attribute.String("my_attribute", "val"),
   ))
   defer span.End()

   // Add some event to show Events usage
   span.AddEvent("checking name...")

   if name == "" {
      err := fmt.Errorf("name cannot be empty")

      // Use the helper functions tracing.Errorf or tracing.Error
      // to set the span’s status to Error to make
      // the span tracking a failed operation as an error span and
      // record the error as an exception span event for the provided span.
      return "", tracing.Errorf(span, "failed to check name: %w", err)
   }

   // Add some other event to show Events usage
   span.AddEvent("name checked")

   // Add attribute to show Attributes usage
   span.SetAttributes(
      attribute.String("my_service.name", name),
      attribute.Int64("my_service.some_other", int64(1337)),
   )

   return fmt.Sprintf("Hello %s", name), nil
}

```

### Naming conventions for spans

Span names should follow the [guidelines from OpenTelemetry](https://opentelemetry.io/docs/reference/specification/trace/api/#span).

| Span Name                 | Guidance                                                   |
| ------------------------- | ---------------------------------------------------------- |
| `get`                     | Too general                                                |
| `get_account/42`          | Too specific                                               |
| `get_account`             | Good, and `account_id=42` would make a nice Span attribute |
| `get_account/{accountId}` | Also good (using the “HTTP route”)                         |

Span attribute and span event attributes should follow the [attribute naming specification from OpenTelemetry](https://opentelemetry.io/docs/reference/specification/common/attribute-naming/).

These are a few examples of good attributes:

- `service.version`
- `http.status_code`

Refer to [trace semantic conventions from OpenTelemetry](https://opentelemetry.io/docs/reference/specification/trace/semantic_conventions/) for additional conventions regarding well-known protocols and operations.

### Span names and high cardinality

Be careful with what span names you add or accept. Using or allowing too many span names can result in high cardinality problems.

### Validate and sanitize input coming from user input

If span names, attribute values, or event values originate from user input, they should be validated and sanitized. It's very important to only allow a pre-defined set of span names to minimize the risk of high cardinality problems.

Be careful to not expose any sensitive information in span names, attribute or event values; for example, secrets, credentials, and so on.

### Span attributes

Consider using `attributes.<Type>("<key>", <value>)` instead of `attributes.Key("<key>").<Type>(<value>)` since it requires fewer characters and is easier to read.

For example:

```go
attribute.String("datasource_name", proxy.ds.Name)
// vs
attribute.Key("datasource_name").String(proxy.ds.Name)

attribute.Int64("org_id", proxy.ctx.SignedInUser.OrgID)
// vs
attribute.Key("org_id").Int64(proxy.ctx.SignedInUser.OrgID)
```

### How to collect, visualize and query traces (and correlate logs with traces) locally

1. Start Jaeger

   ```bash
   make devenv sources=jaeger
   ```

1. Enable tracing in Grafana<a name="enable-tracing-in-grafana"></a>

   To enable tracing in Grafana, you must set the address in your `config.ini` file:

   ```ini
   [tracing.opentelemetry.jaeger]
   address = http://localhost:14268/api/traces
   ```

1. Search/browse collected logs and traces in Grafana Explore

   You need provisioned `gdev-jaeger` and `gdev-loki` data sources. Refer to [developer dashboard and data sources](https://github.com/grafana/grafana/tree/main/devenv#developer-dashboards-and-data-sources) for set up instructions.

   Open Grafana explore and select the `gdev-loki` data source and use the query `{filename="/var/log/grafana/grafana.log"} | logfmt`.

   You can then inspect any log message that includes a `traceID` and from there click `gdev-jaeger` to split the view and inspect the trace in question.

1. Search or browse collected traces in Jaeger UI

   You can open `http://localhost:16686` to use the Jaeger UI for browsing and searching traces.
