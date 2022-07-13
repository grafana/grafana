---
aliases:
  - /docs/grafana/latest/enterprise/aws-secrets-plugin/
description: 'Configuring the AWS Secrets Manager plugin'
keywords:
  - grafana
  - secrets
  - secretsmanager
  - aws
  - backend
title: AWS Secrets Manager Plugin
weight: 2000
---

# AWS Secrets Manager Plugin

By default, Grafana stores all encrypted secrets in its own SQL database. The AWS Secrets Manager plugin is available for users who wish to store secrets in [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/). In the current version of Grafana, this is limited to datasource secrets, but it will eventually include all secrets (e.g. user credentials).

There are a number of configuration options available that determine secret storage behavior in AWS Secrets Manager. We also provide the ability to migrate secrets from existing Grafana instances to AWS Secrets Manager. We provide a degree of backwards compatibility so that the plugin can be quickly uninstalled, but it has some [limitations](#limitations).

## Installation

You can install the plugin using Grafana CLI:

```sh
grafana-cli plugins install grafana-aws-secrets-manager
```

After the plugin is installed, it must be explicitly enabled. You can do this by adding the following to the Grafana `custom.ini` file:

```ini
[secrets]
use_plugin = true
```

## Authentication

By default, the plugin will attempt to authenticate and select an AWS region using parameters read from the runtime environment. For more details, see the [AWS CLI](https://aws.amazon.com/cli/) setup documentation.

Alternatively, you can configure authentication and region selection explicitly through Grafana’s configuration. The full list of available options can be found below. For more information on configuring Grafana, see [Configuring Grafana]({{< relref "../setup-grafana/configure-grafana/" >}}).

## Configuring the plugin

To begin, create a new configuration section in the custom.ini file called `[plugin.grafana-aws-secrets-manager]`. Place all of the following configuration settings under this section. All of following settings are optional.

| Setting                 | Description                                                                                                                                                        | Example                                  | Default                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------- |
| `aws_access_key_id`     | IAM user’s Access Key ID                                                                                                                                           | AKIAIOSFODNN7EXAMPLE                     | _Read from runtime environment_ |
| `aws_secret_access_key` | IAM user’s Secret Access Key                                                                                                                                       | wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY | _Read from runtime environment_ |
| `aws_region`            | AWS instance region                                                                                                                                                | us-east-1                                | _Read from runtime environment_ |
| `kms_key_id`            | AWS Key Management System access key, used for secret encryption                                                                                                   | 82065da4-3e2b-4372-87bf-664d1e488244     | _none_                          |
| `secret_name_prefix`    | String prepended to each AWS Secret Manager secret name. This can be used to avoid secret name conflicts in large organizations running multiple Grafana instances | metrics-team                             | _none_                          |
| `secret_description`    | Description applied to every secret in AWS Secrets Manager. For bookkeeping purposes only                                                                          | Metrics team datasource                  | _none_                          |

## Migration

You can configure Grafana to migrate your existing secrets from Grafana to the plugin on startup. This migration is a one-time blocking operation that runs on Grafana startup, meaning Grafana will not be usable until migration is complete.

**Note:** The speed of this migration is contingent on the number of secrets and system performance, so it can potentially run slowly (e.g. two secrets per second).

Once migration to the plugin has completed, and if [backwards compatibility](#backwards-compatibility) is disabled, the plugin will be required for Grafana to start. If the plugin is uninstalled unexpectedly, or if it fails to start for any reason, Grafana will also fail to start. Because the ability to migrate from the plugin back to Grafana is not yet implemented, we highly recommend keeping backwards compatibility turned on (default).

### Migration to plugin

Migration from Grafana to the plugin is initiated by configuration. Add the following to the Grafana `custom.ini` file:

```ini
[secrets]
migrate_to_plugin = true
```

Secrets will be migrated to the plugin one-by-one, then deleted from the Grafana database if backwards compatibility is disabled.

## Backwards compatibility

By default, after the plugin is installed and enabled, secrets will be stored in AWS Secrets Manager **and** in a legacy location in the Grafana database. If you wish to stop to storing secrets in the legacy table while the secrets plugin is enabled, you can disable backwards compatibility by adding a [feature toggle]({{< relref "../setup-grafana/configure-grafana/#feature_toggles" >}}) called `disableSecretsCompatibility`:

```ini
[feature_toggles]
enabled = disableSecretsCompatibility
```

While secrets will not be read from this table while the plugin is active, it gives the ability to quickly uninstall the secrets plugin without losing access to all of your secrets. Because the ability to migrate from the plugin back to Grafana is not yet implemented, we highly recommend keeping backwards compatibility turned on.

## Limitations

If secret rotation has been activated on your AWS Secrets Manager instance, the backwards compatibility feature will not be sufficient as a fallback for plugin errors. This is because legacy secrets will not be kept up to date with AWS Secrets Manager automatically. If you are planning to implement secret rotation, we recommend waiting until migration from the plugin back to Grafana is available if there is a desire to potentially uninstall the AWS Secrets Manager plugin.
