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
title: AWS Secrets Manager Integration
weight: 2000
---

# AWS Secrets Manager Plugin

By default, Grafana stores all encrypted secrets in its own SQL database. To store secrets in [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/), use the AWS Secrets Manager plugin. This is limited to datasource secrets as of Grafana version 9.1, but future versions will include all secrets, such as user credentials.

You can configure options in the plugin to determine secret storage behavior in AWS Secrets Manager, and also migrate secrets from existing Grafana instances to AWS Secrets Manager. We also provide backward compatibility so that the plugin can be safely uninstalled, with some [limitations](#limitations).

> **Note:** Available only in [Grafana Enterprise]({{< relref "/enterprise/" >}}).
## Installation

You can install the plugin using [Grafana CLI]({{< relref "../../../cli/" >}}):

```sh
grafana-cli plugins install grafana-aws-secrets-manager
```

After the plugin is installed, it must be explicitly enabled. You can do this by adding the following to the Grafana `custom.ini` file:

```ini
[secrets]
use_plugin = true
```

## Authentication

By default, the plugin attempts to authenticate with AWS and select a region using parameters read from the runtime environment. For more details, see the [AWS CLI](https://aws.amazon.com/cli/) setup documentation.

Alternatively, you can configure authentication and region selection explicitly through Grafana's configuration. For a full list of available options, see [Configuring the plugin](#configuring-the-plugin). For more information on configuring Grafana, see [Configuring Grafana]({{< relref "../setup-grafana/configure-grafana/" >}}).

## Configure the plugin

1. Open the **custom.ini** file.
2. Create a configuration section file called `[plugin.grafana-aws-secrets-manager]`. 
3. Place the following optional configuration settings in the `aws-secrets-manager` section.

| Setting                 | Description                                                                                                                                                        | Example                                  | Default                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------- |
| `aws_access_key_id`     | IAM user’s Access Key ID                                                                                                                                           | AKIAIOSFODNN7EXAMPLE                     | _Read from runtime environment_ |
| `aws_secret_access_key` | IAM user’s Secret Access Key                                                                                                                                       | wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY | _Read from runtime environment_ |
| `aws_region`            | AWS instance region                                                                                                                                                | us-east-1                                | _Read from runtime environment_ |
| `kms_key_id`            | AWS Key Management System access key, used for secret encryption                                                                                                   | 82065da4-3e2b-4372-87bf-664d1e488244     | _none_                          |
| `secret_name_prefix`    | String prepended to each AWS Secret Manager secret name. Use this to avoid secret name conflicts in large organizations running multiple Grafana instances. | metrics-team                             | _none_                          |
| `secret_description`    | Description applied to every secret in AWS Secrets Manager. Use only for bookkeeping purposes.                                                                          | Metrics team datasource                  | _none_                          |

## Migration

You can configure Grafana to migrate your existing secrets from Grafana to the plugin on startup. This migration is a one-time blocking operation that runs on Grafana startup, meaning Grafana will not be usable until migration is complete.

> **Note:** The speed of this migration is contingent on the number of secrets and system performance, and can run at a rate as low as two secrets per second.

Once migration to the plugin has completed, the plugin must be installed for Grafana to start unless backward compatibility is enabled. If the plugin is uninstalled unexpectedly, or if it fails to start for any reason, Grafana will also fail to start.

> **Note:** Because we have not yet implemented migrations from the plugin back to Grafana's database, we strongly recommend keeping backward compatibility enabled, as is the default.

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
