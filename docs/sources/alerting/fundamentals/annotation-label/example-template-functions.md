---
aliases:
  - /docs/grafana/latest/alerting/contact-points/message-templating/example-template-functions/
  - /docs/grafana/latest/alerting/fundamentals/annotation-label/example-template-functions/
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - templating
title: Examples of template functions
weight: 130
---

# Examples of template functions

## humanize

**Template string** `{ humanize $value }`

**Input** `1234567.0`

**Expected** `1.235M`

## humanize1024

**TemplateString** `{ humanize1024 $value } `

**Input** `1048576.0`

**Expected** `1Mi`

## humanizeDuration

**TemplateString** `{ humanizeDuration $value }`

**Input** `899.99`

**Expected** `14m 59s`

### humanizePercentage

**TemplateString** `{ humanizePercentage $value }`

**Input** `0.1234567`

**Expected** `12.35%`

## humanizeTimestamp

**TemplateString** `{ $value | humanizeTimestamp }`

**Input** `1435065584.128`

**Expected** `2015-06-23 13:19:44.128 +0000 UTC`

## title

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

## match

**TemplateString** `{ match "a+" $labels.instance }`

**Input** `aa`

**Expected** `true`

## reReplaceAll

**TemplateString** `{{ reReplaceAll "localhost:(.*)" "my.domain:$1" $labels.instance }}`

**Input** `localhost:3000`

**Expected** `my.domain:3000`

### graphLink

**TemplateString** `{{ graphLink "{\"expr\": \"up\", \"datasource\": \"gdev-prometheus\"}" }}`

**Expected** `/explore?left={"datasource":"gdev-prometheus","queries":[{"datasource":"gdev-prometheus","expr":"up","instant":false,"range":true,"refId":"A"}],"range":{"from":"now-1h","to":"now"}}`

### tableLink

**TemplateString** `{{ tableLink "{\"expr\": \"up\", \"datasource\": \"gdev-prometheus\"}" }}`

**Expected** `/explore?left={"datasource":"gdev-prometheus","queries":[{"datasource":"gdev-prometheus","expr":"up","instant":true,"range":false,"refId":"A"}],"range":{"from":"now-1h","to":"now"}}`

## args

**TemplateString** `{{define "x"}}{{.arg0}} {{.arg1}}{{end}}{{template "x" (args 1 "2")}}`

**Expected** `1 2`

## externalURL

**TemplateString** `{ externalURL }`

**Expected** `http://localhost/path/prefix`

## pathPrefix

**TemplateString** `{ pathPrefix }`

**Expected** `/path/prefix`
