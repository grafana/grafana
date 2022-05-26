---
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - templating
title: Template functions
---

# Template Functions

Template functions allow you to process labels and annotations to generate dynamic notifications.

| Name                                      | Argument type                                                | Return type            | Description                                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [humanize](#humanize)                     | number or string                                             | string                 | Converts a number to a more readable format, using metric prefixes.                                                                         |
| [humanize1024](#humanize1024)             | number or string                                             | string                 | Like humanize, but uses 1024 as the base rather than 1000.                                                                                  |
| [humanizeDuration](#humanizeduration)     | number or string                                             | string                 | Converts a duration in seconds to a more readable format.                                                                                   |
| [humanizePercentage](#humanizepercentage) | number or string                                             | string                 | Converts a ratio value to a fraction of 100.                                                                                                |
| [humanizeTimestamp](#humanizetimestamp)   | number or string                                             | string                 | Converts a Unix timestamp in seconds to a more readable format.                                                                             |
| [title](#title)                           | string                                                       | string                 | strings.Title, capitalises first character of each word.                                                                                    |
| [toUpper](#toupper)                       | string                                                       | string                 | strings.ToUpper, converts all characters to upper case.                                                                                     |
| [toLower](#tolower)                       | string                                                       | string                 | strings.ToLower, converts all characters to lower case.                                                                                     |
| [match](#match)                           | pattern, text                                                | boolean                | regexp.MatchString Tests for a unanchored regexp match.                                                                                     |
| [reReplaceAll](#rereplaceall)             | pattern, replacement, text                                   | string                 | Regexp.ReplaceAllString Regexp substitution, unanchored.                                                                                    |
| [graphLink](#graphlink)                   | string - JSON Object with `"expr"` and `"datasource"` fields | string                 | Returns the path to graphical view in [Explore](https://grafana.com/docs/grafana/latest/explore/) for the given expression and data source. |
| [tableLink](#tablelink)                   | string- JSON Object with `"expr"` and `"datasource"` fields  | string                 | Returns the path to tabular view in [Explore](https://grafana.com/docs/grafana/latest/explore/) for the given expression and data source.   |
| [args](#args)                             | []interface{}                                                | map[string]interface{} | Converts a list of objects to a map with keys, for example, arg0, arg1. Use this function to pass multiple arguments to templates.          |
| [externalURL](#externalurl)               | nothing                                                      | string                 | Returns a string representing the external URL.                                                                                             |
| [pathPrefix](#pathprefix)                 | nothing                                                      | string                 | Returns the path of the external URL.                                                                                                       |

## Examples

### humanize

**Template string** `{ humanize $value }`

**Input** `1234567.0`

**Expected** `1.235M`

### humanize1024

**TemplateString** `{ humanize1024 $value } `

**Input** `1048576.0`

**Expected** `1Mi`

### humanizeDuration

**TemplateString** `{ humanizeDuration $value }`

**Input** `899.99`

**Expected** `14m 59s`

### humanizePercentage

**TemplateString** `{ humanizePercentage $value }`

**Input** `0.1234567`

**Expected** `12.35%`

### humanizeTimestamp

**TemplateString** `{ $value | humanizeTimestamp }`

**Input** `1435065584.128`

**Expected** `2015-06-23 13:19:44.128 +0000 UTC`

### title

**TemplateString** `{ $value | title }`

**Input** `aa bb CC`

**Expected** `Aa Bb Cc`

### toUpper

**TemplateString** `{ $value | toUpper }`

**Input** `aa bb CC`

**Expected** `AA BB CC`

### toLower

**TemplateString** `{ $value | toLower }`

**Input** `aA bB CC`

**Expected** `aa bb cc`

### match

**TemplateString** `{ match "a+" $labels.instance }`

**Input** `aa`

**Expected** `true`

### reReplaceAll

**TemplateString** `{{ reReplaceAll "localhost:(.*)" "my.domain:$1" $labels.instance }}`

**Input** `localhost:3000`

**Expected** `my.domain:3000`

### graphLink

**TemplateString** `{{ graphLink "{\"expr\": \"up\", \"datasource\": \"gdev-prometheus\"}" }}`

**Expected** `/explore?left=["now-1h","now","gdev-prometheus",{"datasource":"gdev-prometheus","expr":"up","instant":false,"range":true}]`

### tableLink

**TemplateString** `{{ tableLink "{\"expr\": \"up\", \"datasource\": \"gdev-prometheus\"}" }}`

**Expected** `/explore?left=["now-1h","now","gdev-prometheus",{"datasource":"gdev-prometheus","expr":"up","instant":true,"range":false}]`

### args

**TemplateString** `{{define "x"}}{{.arg0}} {{.arg1}}{{end}}{{template "x" (args 1 "2")}}`

**Expected** `1 2`

### externalURL

**TemplateString** `{ externalURL }`

**Expected** `http://localhost/path/prefix`

### pathPrefix

**TemplateString** `{ pathPrefix }`

**Expected** `/path/prefix`
