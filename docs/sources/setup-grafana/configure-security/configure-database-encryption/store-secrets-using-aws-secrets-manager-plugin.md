---
aliases:
  - /docs/grafana/latest/setup-grafana/configure-security/configure-database-encryption/store-secrets-using-aws-secrets=manager-plugin/
description: 'Learn how to use AWS Secrets Manager plugin to store Grafana secrets.'
keywords:
  - grafana
  - secrets
  - secretsmanager
  - aws
  - backend
title: Store secrets using AWS Secrets Manager plugin
menuTitle: Store Secrets in AWS Secrets Manager
weight: 2000
---

# Store secrets using AWS Secrets Manager plugin

By default, Grafana stores all encrypted secrets in its own SQL database. To store secrets in [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/), use the AWS Secrets Manager plugin. This is limited to datasource secrets as of Grafana version 9.1, but future versions will include all secrets, such as user credentials.

You can configure options in the plugin to determine secret storage behavior in AWS Secrets Manager, and also migrate secrets from existing Grafana instances to AWS Secrets Manager. We also provide backward compatibility so that the plugin can be safely uninstalled, with some [limitations](#limitations).

> **Note:** Available only in [Grafana Enterprise]({{< relref "../../../enterprise/" >}}).

## Install the plugin

You can install the plugin using [Grafana CLI]({{< relref "../../../cli/" >}}):

```sh
grafana-cli plugins install grafana-aws-secretsmanager
```

After you install the plugin, you must enable it.

1. Open the Grafana **custom.ini** file.
1. Locate or create the `[secrets]` section.
1. Set the key `use_plugin` to `true`.
1. Save your changes and restart the Grafana server.

```
[secrets]
use_plugin = true
```

If you have enabled the plugin correctly, you will see the plugin listed in the [plugin catalog]({{< relref "../../../administration/plugin-management/#plugin-catalog" >}}) with the badges `Installed` and `Signed`.

## Authenticate with AWS

By default, the plugin attempts to authenticate with AWS and select a region using parameters read from the runtime environment. For more details, see the [AWS CLI](https://aws.amazon.com/cli/) setup documentation.

Alternatively, you can configure authentication and region selection explicitly through Grafana's configuration. For a full list of available options, see [Configure the plugin](#configure-the-plugin). For more information on configuring Grafana, see [Configure Grafana]({{< relref "../../configure-grafana/" >}}).

## Configure the plugin

1. Open the **custom.ini** file.
1. Create a configuration section file called `[plugin.grafana-aws-secretsmanager]`.
1. Place the following optional configuration settings in the new section.

| Setting                 | Description                                                                                                                                                 | Example                                      | Default                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------- |
| `aws_access_key_id`     | IAM user’s Access Key ID                                                                                                                                    | AKIAIOSFODNN7EXAMPLE                         | _Read from runtime environment_ |
| `aws_secret_access_key` | IAM user’s Secret Access Key                                                                                                                                | wJalrXUtnFEMI/K7MDENG/<br>bPxRfiCYEXAMPLEKEY | _Read from runtime environment_ |
| `aws_region`            | AWS instance region                                                                                                                                         | us-east-1                                    | _Read from runtime environment_ |
| `kms_key_id`            | AWS Key Management System access key, used for secret encryption                                                                                            | 82065da4-3e2b-4372<br>-87bf-664d1e488244     | _none_                          |
| `secret_name_prefix`    | String prepended to each AWS Secret Manager secret name. Use this to avoid secret name conflicts in large organizations running multiple Grafana instances. | metrics-team                                 | _none_                          |
| `secret_description`    | Description applied to every secret in AWS Secrets Manager. Use only for bookkeeping purposes.                                                              | Metrics team datasource                      | _none_                          |

### Sample configuration

Here is a sample **config.ini** to configure the plugin and [enable migration](#migrate-your-secrets-to-the-plugin).

```ini
[secrets]
use_plugin = true
migrate_to_plugin = true

[plugin.grafana-aws-secretsmanager]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
aws_region = us-east-1
kms_key_id = 82065da4-3e2b-4372-87bf-664d1e488244
secret_name_prefix = my-org
secret_description = My description
```

## Migrate your secrets to the plugin

You can configure Grafana to migrate your existing secrets from Grafana to the plugin on startup. This migration is a one-time blocking operation that runs on Grafana startup, meaning Grafana will not be usable until migration is complete.

> **Note:** The speed of this migration is contingent on the number of secrets and system performance, and can run at a rate as low as two secrets per second.

Once migration to the plugin has completed, the plugin must remain installed for Grafana to start unless backward compatibility is enabled. If the plugin is uninstalled unexpectedly, or if it fails to start for any reason, Grafana will also fail to start.

> **Note:** Because we have not yet implemented migrations from the plugin back to Grafana's database, we strongly recommend keeping backward compatibility enabled, as is the default.

### Initiate the migration

To initiate secret migration from Grafana to the plugin, enable the `migrate_to_plugin` setting in the `secrets` section of the Grafana **custom.ini** file:

```ini
[secrets]
migrate_to_plugin = true
```

The plugin migrates secrets individually. If backward compatibility is disabled, it also deletes them from the Grafana database.

## Backward compatibility

After the plugin is installed and enabled, secrets are stored by default in both AWS Secrets Manager **and** in a legacy location in the Grafana database.

To stop storing secrets in the legacy table while the secrets plugin is enabled, disable backward compatibility by adding a [feature toggle]({{< relref "../../configure-grafana/#feature_toggles" >}}) called `disableSecretsCompatibility`:

```ini
[feature_toggles]
enabled = disableSecretsCompatibility
```

While secrets will not be read from this legacy table while the plugin is active, backward compatibility allows you to uninstall the secrets plugin without losing access to all of your secrets.

> **Note:** We have not yet implemented migrations from the plugin back to Grafana's database. Disabling backward compatibility and uninstalling the plugin can cause Grafana to fail to start. We strongly recommend keeping backward compatibility enabled, as is the default.

## Limitations

If your AWS Secrets Manager instance uses secret rotation, the backward compatibility feature will not be a sufficient fallback for plugin errors, because legacy secrets will not be kept up to date with AWS Secrets Manager automatically. If you plan to implement secret rotation, we recommend that you avoid installing this plugin until we implement migration from the plugin back to Grafana's database.
