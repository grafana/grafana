# Instrumenting Grafana

Guidance, conventions and best practices for instrumenting Grafana using logs, metrics and traces.

## Logs

Logs are files that record events, warnings and errors as they occur within a software environment. Most logs include contextual information, such as the time an event occurred and which user or endpoint was associated with it.

### Usage

Use the _pkg/infra/log_ package to create a named structured logger. Example:

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

Name the logger using lowercase characters, e.g. `log.New("my-logger")` using snake_case or kebab-case styling.

Prefix the logger name with an area name when using different loggers across a feature or related packages, e.g. `log.New("plugin.loader")` and `log.New("plugin.client")`.

Start the log message with a capital letter, e.g. `logger.Info("Hello world")` instead of `logger.Info("hello world")`. The log message should be an identifier for the log entry, avoid parameterization in favor of key-value pairs for additional data.

Prefer using camelCase style when naming log keys, e.g. _remoteAddr_, to be consistent with Go identifiers.

Use the key _error_ when logging Go errors, e.g. `logger.Error("Something failed", "error", fmt.Errorf("BOOM"))`.

### Validate and sanitize input coming from user input

If log messages or key/value pairs originates from user input they **should** be validated and sanitized.

Be **careful** to not expose any sensitive information in log messages e.g. secrets, credentials etc. It's especially easy to do by mistake when including a struct as value.

### Log levels

When to use which log level?

- **Debug:** Informational messages of high frequency and/or less-important messages during normal operations.
- **Info:** Informational messages of low frequency and/or important messages.
- **Warning:** Should in normal cases not be used/needed. If used should be actionable.
- **Error:** Error messages indicating some operation failed (with an error) and the program didn't have a way of handle the error.

### Contextual logging

Use a contextual logger to include additional key/value pairs attached to `context.Context`, e.g. `traceID`, to allow correlating logs with traces and/or correlate logs with a common identifier.

You must [Enable tracing in Grafana](#2-enable-tracing-in-grafana) to get a traceID

Example:

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

During development it's convenient to enable certain log level, e.g. debug, for certain loggers to minimize the generated log output and make it easier to find things. See [[log.filters]](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#filters) for information how to configure this.

It's also possible to configure multiple loggers:

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

Use the namespace _grafana_ as that would prefix any defined metric names with `grafana_`. This will make it clear for operators that any metric named `grafana_*` belongs to Grafana.

Use snake*case style when naming metrics, e.g. \_http_request_duration_seconds* instead of _httpRequestDurationSeconds_.

Use snake*case style when naming labels, e.g. \_status_code* instead of _statusCode_.

If metric type is a _counter_, name it with a `_total` suffix, e.g. _http_requests_total_.

If metric type is a _histogram_ and you're measuring duration, name it with a `_<unit>` suffix, e.g. _http_request_duration_seconds_.

If metric type is a _gauge_, name it to denote it's a value that can increase and decrease , e.g. _http_request_in_flight_.

### Label values and high cardinality

Be careful with what label values you add/accept. Using/allowing too many label values could result in [high cardinality problems](https://grafana.com/blog/2022/02/15/what-are-cardinality-spikes-and-why-do-they-matter/).

If label values originates from user input they **should** be validated. Use `metricutil.SanitizeLabelName(<label value>`) from _pkg/infra/metrics/metricutil_ package to sanitize label names. Very **important** to only allow a pre-defined set of labels to minimize the risk of high cardinality problems.

Be **careful** to not expose any sensitive information in label values, e.g. secrets, credentials etc.

### Guarantee the existence of metrics

If you want to guarantee the existence of metrics before any observations has happened there's a couple of helper methods available in the _pkg/infra/metrics/metricutil_ package.

### How to collect and visualize metrics locally

1. Start Prometheus

   ```bash
   make devenv sources=prometheus
   ```

2. Use Grafana Explore or dashboards to query any exported Grafana metrics

## Traces

A distributed trace is data that tracks an application request as it flows through the various parts of an application. The trace records how long it takes each application component to process the request and pass the result to the next component. Traces can also identify which parts of the application trigger an error.

### Usage

Grafana currently supports two tracing implementations, [OpenTelemetry](https://opentelemetry.io/) and [OpenTracing](https://opentracing.io/). OpenTracing is deprecated, but still supported until we remove it. The two different implementations implements the `Tracer` and `Span` interfaces, defined in the _pkg/infra/tracing_ package, which you can use to create traces and spans. To get a hold of a `Tracer` you would need to get it injected as dependency into your service, see [Services](services.md) for more details.

Example:

```go
import (
   "fmt"

   "github.com/grafana/grafana/pkg/infra/tracing"
   "go.opentelemetry.io/otel/attribute"
)

type MyService struct {
   tracer tracing.Tracer
}

func ProvideService(tracer tracing.Tracer) *MyService {
   return &MyService{
      tracer: tracer,
   }
}

func (s *MyService) Hello(ctx context.Context, name string) (string, error) {
   ctx, span := s.tracer.Start(ctx, "MyService.Hello")
   // this make sure the span is marked as finished when this
   // method ends to allow the span to be flushed and sent to
   // storage backend.
   defer span.End()

   // Add some event to show Events usage
   span.AddEvents(
      []string{"message"},
      []tracing.EventValue{
         {Str: "checking name..."},
      })

   if name == "" {
      err := fmt.Errorf("name cannot be empty")

      // record err as an exception span event for this span
      span.RecordError(err)
      return "", err
   }

   // Add some other event to show Events usage
   span.AddEvents(
      []string{"message"},
      []tracing.EventValue{
         {Str: "name checked"},
      })

   // Add attribute to show Attributes usage
   span.SetAttributes("my_service.name", name, attribute.Key("my_service.name").String(name))

   return fmt.Sprintf("Hello %s", name), nil
}

```

### Naming conventions

Span names should follow the [guidelines from OpenTelemetry](https://opentelemetry.io/docs/reference/specification/trace/api/#span).

| Span Name               | Guidance                                                 |
| ----------------------- | -------------------------------------------------------- |
| get                     | Too general                                              |
| get_account/42          | Too specific                                             |
| get_account             | Good, and account_id=42 would make a nice Span attribute |
| get_account/{accountId} | Also good (using the “HTTP route”)                       |

Span attribute and span event attributes should follow the [Attribute naming specification from OpenTelemetry](https://opentelemetry.io/docs/reference/specification/common/attribute-naming/). Good attribute key examples:

- service.version
- http.status_code

See [Trace semantic conventions from OpenTelemetry](https://opentelemetry.io/docs/reference/specification/trace/semantic_conventions/) for additional conventions regarding well-known protocols and operations.

### Span names and high cardinality

Be careful with what span names you add/accept. Using/allowing too many span names could result in high cardinality problems.

### Validate and sanitize input coming from user input

If span names, attribute or event values originates from user input they **should** be validated and sanitized. It's very **important** to only allow a pre-defined set of span names to minimize the risk of high cardinality problems.

Be **careful** to not expose any sensitive information in span names, attribute or event values, e.g. secrets, credentials etc.

### How to collect, visualize and query traces (and correlate logs with traces) locally

#### 1. Start Jaeger

```bash
make devenv sources=jaeger
```

#### 2. Enable tracing in Grafana

To enable tracing in Grafana, you must set the address in your config.ini file

opentelemetry tracing (recommended):

```ini
[tracing.opentelemetry.jaeger]
address = http://localhost:14268/api/traces
```

opentracing tracing (deprecated/not recommended):

```ini
[tracing.jaeger]
address = localhost:6831
```

#### 3. Search/browse collected logs and traces in Grafana Explore

You need provisioned gdev-jaeger and gdev-loki datasources, see [developer dashboard and data sources](https://github.com/grafana/grafana/tree/main/devenv#developer-dashboards-and-data-sources) for setup instructions.

Open Grafana explore and select gdev-loki datasource and use the query `{filename="/var/log/grafana/grafana.log"} | logfmt`.

You can then inspect any log message that includes a `traceID` and from there click on `gdev-jaeger` to split view and inspect the trace in question.

#### 4. Search/browse collected traces in Jaeger UI

You can open http://localhost:16686 to use the Jaeger UI for browsing and searching traces.
