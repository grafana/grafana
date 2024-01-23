---
headless: true
labels:
  products:
    - enterprise
    - oss
---

[//]: # 'This file documents the Traces to profile configure and usage for the Tempo data source.'
[//]: # 'This shared file is included in these locations:'
[//]: # '/grafana/docs/sources/datasources/tempo/configure-tempo-data-source.md'
[//]: # '/website/docs/grafana-cloud/data-configuration/traces/traces-query-editor.md'
[//]: #
[//]: # 'If you make changes to this file, verify that the meaning and content are not changed in any place where the file is included.'
[//]: # 'Any links should be fully qualified and not relative: /docs/grafana/ instead of ../grafana/.'

<!-- # Trace to profiles  -->

Using Trace to profiles, you can use Grafana’s ability to correlate different signals by adding the functionality to link between traces and profiles.

**Trace to profiles** lets you link your Grafana Pyroscope data source to tracing data.
When configured, this connection lets you run queries from a trace span into the profile data.

There are two ways to configure the trace to profiles feature:

- Use a simplified configuration with default query, or
- Configure a custom query where you can use a template language to interpolate variables from the trace or span.

To use trace to profiles, navigate to **Explore** and query a trace. Each span now links to your queries. Clicking a link runs the query in a split panel. If tags are configured, Grafana dynamically inserts the span attribute values into the query. The query runs over the time range of the (span start time - 60) to (span end time + 60 seconds).

![Selecting a link in the span queries the profile data source](/static/img/docs/tempo/profiles/tempo-profiles-Span-link-profile-data-source.png)

To use trace to profiles, you must have a configured Grafana Pyroscope data source. For more information, refer to the [Grafana Pyroscope data source documentation](/docs/grafana/latest/datasources/grafana-pyroscope/).

## Use a simple configuration

To use a simple configuration, follow these steps:

1. Select a Pyroscope data source from the **Data source** drop-down.
1. Optional: Choose any tags to use in the query. If left blank, the default values of `service.name` and `service.namespace` are used.

   The tags you configure must be present in the spans attributes or resources for a trace to profiles span link to appear. You can optionally configure a new name for the tag. This is useful for example if the tag has dots in the name and the target data source doesn't allow using dots in labels. In that case you can for example remap `service.name` to `service_name`.

1. Select one or more profile types to use in the query. Select the drop-down and choose options from the menu.

   The profile type or app must be selected for the query to be valid. Grafana doesn't show any data if the profile type or app isn’t selected when a query runs.
   ![Traces to profile configuration options in the Tempo data source](/static/img/docs/tempo/profiles/Tempo-data-source-profiles-Settings.png)

1. Do not select **Use custom query**.
1. Select **Save and Test**.

## Configure a custom query

To use a custom query with the configuration, follow these steps:

1. Select a Pyroscope data source from the **Data source** drop-down.
1. Optional: Choose any tags that will be used in the query. If left blank, the default values of `service.name` and `service.namespace` are used.

   These tags can be used in the custom query with `${__tags}` variable. This variable interpolates the mapped tags as list in an appropriate syntax for the data source and will only include the tags that were present in the span omitting those that weren’t present. You can optionally configure a new name for the tag. This is useful in cases where the tag has dots in the name and the target data source doesn't allow using dots in labels. For example, you can remap `service.name` to `service_name` in such a case. If you don’t map any tags here, you can still use any tag in the query like this `method="${__span.tags.method}"`.

1. Select one or more profile types to use in the query. Select the drop-down and choose options from the menu.
1. Switch on **Use custom query** to enter a custom query.
1. Specify a custom query to be used to query profile data. You can use various variables to make that query relevant for current span. The link is shown only if all the variables are interpolated with non-empty values to prevent creating an invalid query. You can interpolate the configured tags using the `$__tags` keyword.
1. Select **Save and Test**.

## Variables that can be used in a custom query

To use a variable you need to wrap it in `${}`. For example, `${__span.name}`.

| Variable name          | Description                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **\_\_tags**           | This variable uses the tag mapping from the UI to create a label matcher string in the specific data source syntax. The variable only uses tags that are present in the span. The link is still created even if only one of those tags is present in the span. You can use this if all tags are not required for the query to be useful. |
| **\_\_span.spanId**    | The ID of the span.                                                                                                                                                                                                                                                                                                                      |
| **\_\_span.traceId**   | The ID of the trace.                                                                                                                                                                                                                                                                                                                     |
| **\_\_span.duration**  | The duration of the span.                                                                                                                                                                                                                                                                                                                |
| **\_\_span.name**      | Name of the span.                                                                                                                                                                                                                                                                                                                        |
| **\_\_span.tags**      | Namespace for the tags in the span. To access a specific tag named `version`, you would use `${__span.tags.version}`. In case the tag contains dot, you have to access it as `${__span.tags["http.status"]}`.                                                                                                                            |
| **\_\_trace.traceId**  | The ID of the trace.                                                                                                                                                                                                                                                                                                                     |
| **\_\_trace.duration** | The duration of the trace.                                                                                                                                                                                                                                                                                                               |
| **\_\_trace.name**     | The name of the trace.                                                                                                                                                                                                                                                                                                                   |
