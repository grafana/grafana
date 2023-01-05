---
aliases:
  - ../cloudwatch/
description: Guide for provisioning CloudWatch
title: Provision CloudWatch
weight: 400
---

# Provision CloudWatch data source

You can configure the CloudWatch data source by customizing configuration files in Grafana's provisioning system. To know more about provisioning and learn about available configuration options, refer to the [Provisioning Grafana]({{< relref "../../administration/provisioning/#datasources" >}}) topic.

Here are some provisioning examples for this data source.

## Using AWS SDK (default)

```yaml
apiVersion: 1
datasources:
  - name: CloudWatch
    type: cloudwatch
    jsonData:
      authType: default
      defaultRegion: eu-west-2
```

## Using credentials' profile name (non-default)

```yaml
apiVersion: 1

datasources:
  - name: CloudWatch
    type: cloudwatch
    jsonData:
      authType: credentials
      defaultRegion: eu-west-2
      customMetricsNamespaces: 'CWAgent,CustomNameSpace'
      profile: secondary
```

## Using accessKey and secretKey

```yaml
apiVersion: 1

datasources:
  - name: CloudWatch
    type: cloudwatch
    jsonData:
      authType: keys
      defaultRegion: eu-west-2
    secureJsonData:
      accessKey: '<your access key>'
      secretKey: '<your secret key>'
```

## Using AWS SDK Default and ARN of IAM Role to Assume

```yaml
apiVersion: 1
datasources:
  - name: CloudWatch
    type: cloudwatch
    jsonData:
      authType: default
      assumeRoleArn: arn:aws:iam::123456789012:root
      defaultRegion: eu-west-2
```
