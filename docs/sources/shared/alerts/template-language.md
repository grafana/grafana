---
title: 'Template language'
---

## If

You can use `if` statements in templates. For example, you can print `Variable empty` when a variable is empty:

```go
{{ if $element }}
Element value: {{$element}}
{{ else }}
Element is empty
{{ end }}
```

## With

`with` is similar to `if` statements, but unlike `if`, it updates dot(`.`) to refer to the value of the expression in `with`:

```go
{{ with $array }}
There are {{ len . }} item(s)
{{ else }}
There are no alerts
{{ end }}
```

## Range

`range` iterates over an array or map, and dot (`.`) is set to the current element of the array:

```go
{{ range $array }}
{{ .itemPropertyName }}
{{ end }}
```

Optionally, you can handle empty objects using `else`:

```go
{{ range $array }}
  {{ .itemPropertyName }}
{{ else }}
  Empty array
{{ end }}
```

You can also get the index of each item within a range by defining index and value variables at the start of the range:

```go
{{ $num_items := len $array }}
{{ range $index, $item := $array }}
This is item {{ $index }} out of {{ $num_items }}
{{ end }}
```

Additionally, you can use `{{break}}` to stop the remaining iterations or `{{continue}}` to stop the current iteration and continue with the next one.

## Functions

The global functions available in `text/template` are:

| Function   | Description                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `and`      | Returns the boolean AND of its arguments by returning the first empty argument or the last argument.                                                                           |
| `call`     | Returns the result of calling the first argument, which must be a function, with the remaining arguments as parameters.                                                        |
| `html`     | Returns the escaped HTML equivalent of the textual representation of its arguments.                                                                                            |
| `index`    | Returns the result of indexing its first argument by the following arguments, e.g., `{{ index $labels "instance" }}` returns the `instance` key in the `$labels` map variable. |
| `slice`    | Returns the result of slicing its first argument by the remaining arguments.                                                                                                   |
| `js`       | Returns the escaped JavaScript equivalent of the textual representation of its arguments.                                                                                      |
| `len`      | Returns the integer length of its argument, e.g., `{{ len $array }}`                                                                                                           |
| `not`      | Returns the boolean negation of its single argument.                                                                                                                           |
| `or`       | Returns the boolean OR of its arguments by returning the first non-empty argument or the last argument.                                                                        |
| `print`    | An alias for fmt.Sprint                                                                                                                                                        |
| `printf`   | An alias for fmt.Sprintf                                                                                                                                                       |
| `println`  | An alias for fmt.Sprintln                                                                                                                                                      |
| `urlquery` | Returns the escaped value of the textual representation of its arguments in a form suitable for embedding in a URL query                                                       |

For more details, refer to the official documentation on [functions in `text/template`](https://pkg.go.dev/text/template#hdr-Functions).

## Comparison operators

Boolean comparison operators are also available in `text/template`:

| Function | Description                               |
| -------- | ----------------------------------------- |
| `eq`     | Returns the boolean truth of arg1 == arg2 |
| `ne`     | Returns the boolean truth of arg1 != arg2 |
| `lt`     | Returns the boolean truth of arg1 < arg2  |
| `le`     | Returns the boolean truth of arg1 <= arg2 |
| `gt`     | Returns the boolean truth of arg1 > arg2  |
| `ge`     | Returns the boolean truth of arg1 >= arg2 |

## Variables

Variables in `text/template` must be created within the template. For example, you can create a variable with the current value of dot (`.`) and assign a string or another object to the variable like this:

```go
{{ $variable := . }}
{{ $variable := "This is a test" }}
{{ $variable }}
```

This template outputs:

```
This is a test
```

## Templates

You can create reusable templates that can be executed from other templates or within the same template.

Define templates using `define` and the name of the template in double quotes:

```go
{{ define "print_labels" }}
{{ end }}
```

You should not define templates with the same name as other templates, including default templates such as `__subject`, `__text_values_list`, `__text_alert_list`, `default.title` and `default.message`. Where a template has been created with the same name as a default template, or a template in another notification template, Grafana might use either template. Grafana does not prevent, or show an error message, when there are two or more templates with the same name.

### Execute templates

You can execute defined templates using `template`, the name of the template in double quotes, and the cursor that should be passed to the template:

```go
{{ template "print_labels" . }}
```

Within a template dot refers to the value that is passed to the template.

For example, if a template is passed a list of firing alerts then dot refers to that list of firing alerts:

```go
{{ template "print_alerts" .Alerts }}
```

If the template is passed the sorted labels for an alert then dot refers to the list of sorted labels:

```go
{{ template "print_labels" .SortedLabels }}
```

This is useful when writing reusable templates. For example, to print all alerts you might write the following:

```go
{{ template "print_alerts" .Alerts }}
```

Then to print just the firing alerts you could write this:

```go
{{ template "print_alerts" .Alerts.Firing }}
```

This works because both `.Alerts` and `.Alerts.Firing` is a list of alerts.

```go
{{ define "print_alerts" }}
{{ range . }}
{{ template "print_labels" .SortedLabels }}
{{ end }}
{{ end }}
```

{{< admonition type="note" >}}
You cannot create independent, reusable templates for labels and annotations as you can with notification templates. In alert rule templates, you need to write each template inline within the label or annotation field.
{{< /admonition >}}

## Comments

You can add comments with `{{/*` and `*/}}`:

```go
{{/* This is a comment */}}
```

To avoid adding line breaks, use:

```go
{{- /* This is a comment with no leading or trailing line breaks */ -}}
```

## Indentation

You can use indentation, both tabs and spaces, and line breaks, to make templates more readable:

```go
{{ range .Alerts }}
  {{ range .Labels.SortedPairs }}
    {{ .Name }} = {{ .Value }}
  {{ end }}
{{ end }}
```

However, indentation in the template is also present in the text.

### Remove spaces and line breaks

In text/template use `{{-` and `-}}` to remove leading and trailing spaces and line breaks.

For example, when using indentation and line breaks to make a template more readable:

```go
{{ range .Alerts }}
  {{ range .Labels.SortedPairs }}
    {{ .Name }} = {{ .Value }}
  {{ end }}
{{ end }}
```

The indentation and line breaks are also present in the text:

```
    alertname = "Test"

    grafana_folder = "Test alerts"
```

You can remove the indentation and line breaks from the text changing `}}` to `-}}` at the start of each range:

```go
{{ range .Alerts -}}
  {{ range .Labels.SortedPairs -}}
    {{ .Name }} = {{ .Value }}
  {{ end }}
{{ end }}
```

The indentation and line breaks in the template are now absent from the text:

```
alertname = "Test"
grafana_folder = "Test alerts"
```
