---
aliases:
keywords:
  - grafana
  - alerting
  - notifications
  - templates
  - write templates
title: Using Go's templating language
weight: 100
---

# Using Go's templating language

You write notification templates in Go's templating language, [text/template](https://pkg.go.dev/text/template).

Before you start creating your own notification templates, we recommend that you read through this topic, which provides you with an overview of Go's templating language and writing templates in text/template.

## Dot

In text/template there is a special cursor called dot, and is written as `.`. You can think of this cursor as a variable whose value changes depending where in the template it is used. For example, at the start of a notification template `.` refers to something called [`ExtendedData`]({{< relref "./reference#extendeddata" >}}) which contains a number of fields including `Alerts`, `Status`, `GroupLabels`, `CommonLabels`, `CommonAnnotations` and `ExternalURL`. However, dot might refer to something else when used in a range over a list, when used inside a `with`, or when writing feature templates to be used in other templates. You can see examples of this in [Create notification templates]({{< relref "./create-notification-templates" >}}), and all data and functions in the [Reference]({{< relref "./reference" >}}).

## Opening and closing tags

In text/template, templates start with `{{` and end with `}}` irrespective of whether the template prints a variable or executes control structures such as if statements. This is different from other templating languages such as Jinja where printing a variable uses `{{` and `}}` and control structures use `{%` and `%}`.

## Print

To print the value of something use `{{` and `}}`. You can print the value of dot, a field of dot, the result of a function, and the value of a [variable]({{< relref "#variables" >}}). For example, to print the `Alerts` field where dot refers to `ExtendedData` you would write the following:

```
{{ .Alerts }}
```

## Iterate over alerts

To print just the labels of each alert, rather than all information about the alert, you can use a `range` to iterate the alerts in `ExtendedData`:

```
{{ range .Alerts }}
{{ .Labels }}
{{ end }}
```

Inside the range dot no longer refers to `ExtendedData`, but to an `Alert`. You can use `{{ .Labels }}` to print the labels of each alert. This works because `{{ range .Alerts }}` changes dot to refer to the current alert in the list of alerts. When the range is finished dot is reset to the value it had before the start of the range, which in this example is `ExtendedData`:

```
{{ range .Alerts }}
{{ .Labels }}
{{ end }}
{{/* does not work, .Labels does not exist here */}}
{{ .Labels }}
{{/* works, cursor was reset */}}
{{ .Status }}
```

## Iterate over annotations and labels

Let's write a template to print the labels of each alert in the format `The name of the label is $name, and the value is $value`, where `$name` and `$value` contain the name and value of each label.

Like in the previous example, use a range to iterate over the alerts in `.Alerts` such that dot refers to the current alert in the list of alerts, and then use a second range on the sorted labels so dot is updated a second time to refer to the current label. Inside the second range use `.Name` and `.Value` to print the name and value of each label:

```
{{ range .Alerts }}
{{ range .Labels.SortedPairs }}
The name of the label is {{ .Name }}, and the value is {{ .Value }}
{{ end }}
{{ range .Annotations.SortedPairs }}
The name of the annotation is {{ .Name }}, and the value is {{ .Value }}
{{ end }}
{{ end }}
```

## The index function

To print a specific annotation or label use the `index` function.

```
{{ range .Alerts }}
The name of the alert is {{ index .Labels "alertname" }}
{{ end }}
```

## If statements

You can use if statements in templates. For example, to print `There are no alerts` if there are no alerts in `.Alerts` you would write the following:

```
{{ if .Alerts }}
There are alerts
{{ else }}
There are no alerts
{{ end }}
```

## With

With is similar to if statements, however unlike if statements, `with` updates dot to refer to the value of the with:

```
{{ with .Alerts }}
There are {{ len . }} alert(s)
{{ else }}
There are no alerts
{{ end }}
```

## Variables

Variables in text/template must be created within the template. For example, to create a variable called `$variable` with the current value of dot you would write the following:

```
{{ $variable := . }}
```

You can use `$variable` inside a range or `with` and it will refer to the value of dot at the time the variable was defined, not the current value of dot.

For example, you cannot write a template that use `{{ .Labels }}` in the second range because here dot refers to the current label, not the current alert:

```
{{ range .Alerts }}
{{ range .Labels.SortedPairs }}
{{ .Name }} = {{ .Value }}
{{/* does not work because in the second range . is a label not an alert */}}
There are {{ len .Labels }}
{{ end }}
{{ end }}
```

You can fix this by defining a variable called `$alert` in the first range and before the second range:

```
{{ range .Alerts }}
{{ $alert := . }}
{{ range .Labels.SortedPairs }}
{{ .Name }} = {{ .Value }}
{{/* works because $alert refers to the value of dot inside the first range */}}
There are {{ len $alert.Labels }}
{{ end }}
{{ end }}
```

## Range with index

You can get the index of each alert within a range by defining index and value variables at the start of the range:

```
{{ $num_alerts := len .Alerts }}
{{ range $index, $alert := .Alerts }}
This is alert {{ $index }} out of {{ $num_alerts }}
{{ end }}
```

## Define templates

You can define templates using `define` and the name of the template in double quotes. You should not define templates with the same name as other templates, including default templates such as `__subject`, `__text_values_list`, `__text_alert_list`, `default.title` and `default.message`. Where a template has been created with the same name as a default template, or a template in another notification template, Grafana might use either template. Grafana does not prevent, or show an error message, when there are two or more templates with the same name.

```
{{ define "print_labels" }}
{{ end }}
```

## Execute templates

You can execute defined templates using `template`, the name of the template in double quotes, and the cursor that should be passed to the template:

```
{{ template "print_labels" . }}
```

## Pass data to templates

Within a template dot refers to the value that is passed to the template.

For example, if a template is passed a list of firing alerts then dot refers to that list of firing alerts:

```
{{ template "print_alerts" .Alerts }}
```

If the template is passed the sorted labels for an alert then dot refers to the list of sorted labels:

```
{{ template "print_labels" .SortedLabels }}
```

This is useful when writing reusable templates. For example, to print all alerts you might write the following:

```
{{ template "print_alerts" .Alerts }}
```

Then to print just the firing alerts you could write this:

```
{{ template "print_alerts" .Alerts.Firing }}
```

This works because both `.Alerts` and `.Alerts.Firing` is a list of alerts.

```
{{ define "print_alerts" }}
{{ range . }}
{{ template "print_labels" .SortedLabels }}
{{ end }}
{{ end }}
```

## Comments

You can add comments with `{{/*` and `*/}}`:

```
{{/* This is a comment */}}
```

To prevent comments from adding line breaks use:

```
{{- /* This is a comment with no leading or trailing line breaks */ -}}
```

## Indentation

You can use indentation, both tabs and spaces, and line breaks, to make templates more readable:

```
{{ range .Alerts }}
  {{ range .Labels.SortedPairs }}
    {{ .Name }} = {{ .Value }}
  {{ end }}
{{ end }}
```

However, indentation in the template will also be present in the text. Next we will see how to remove it.

## Remove spaces and line breaks

In text/template use `{{-` and `-}}` to remove leading and trailing spaces and line breaks.

For example, when using indentation and line breaks to make a template more readable:

```
{{ range .Alerts }}
  {{ range .Labels.SortedPairs }}
    {{ .Name }} = {{ .Value }}
  {{ end }}
{{ end }}
```

The indentation and line breaks will also be present in the text:

```
    alertname = "Test"

    grafana_folder = "Test alerts"
```

You can remove the indentation and line breaks from the text changing `}}` to `-}}` at the start of each range:

```
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
