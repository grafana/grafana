+++
aliases = ["/docs/grafana/latest/administration/database-encryption/"]
description = "Grafana database encryption"
keywords = ["grafana", "database", "encryption", "envelope encryption", "documentation"]
title = "Database encryption"
weight = 450
+++

# Grafana database encryption

Grafana’s database contains secrets, which are used to query data sources, send alert notifications and perform other functions within Grafana.

Grafana encrypts these secrets before they are written to the database, by using a symmetric-key encryption algorithm called Advanced Encryption Standard (AES), and using a [secret key]({{< relref "../administration/configuration/#secret_key" >}}) that you can change when you configure a new Grafana instance.

Since Grafana v9.0, it uses [envelope encryption](#envelope-encryption) by default, which adds a layer of indirection to the
encryption process that represents an [**implicit breaking change**](#implicit-breaking-change) for older versions of Grafana.

For further details about how to operate a Grafana instance with envelope encryption, see the [Operational work](#operational work) section below.

> **Note:** In Grafana Enterprise, you can also choose to [encrypt secrets in AES-GCM mode]({{< relref "../enterprise/enterprise-encryption/#changing-your-encryption-mode-to-aes-gcm" >}}) instead of AES-CFB.

# Envelope encryption

> **Note:** Since Grafana v9.0, you can turn it off by adding the term `disableEnvelopeEncryption` to the list of
> feature toggles in your [Grafana configuration]({{< relref "../administration/configuration/#feature_toggles" >}}).

Instead of encrypting all secrets with a single key, Grafana uses a set of keys called data encryption keys (DEKs) to
encrypt them. These data encryption keys are themselves encrypted with a single key encryption key (KEK), configured
through the `secret_key` attribute in your
[Grafana configuration]({{< relref "../administration/configuration/#secret_key" >}}) or with a
[KMS integration](#kms-integration).

## Implicit breaking change

As stated above, envelope encryption represents an implicit breaking change because it changes the way secrets stored
in the Grafana database are encrypted. That means Grafana administrators will be able to transition to Grafana v9.0
with no action required from the database encryption perspective, but will need to be extremely careful if they need
to roll back to a previous version (e.g. Grafana v8.5) after being updated, because secrets created or modified after upgrade
the update to Grafana v9.0 won't be decryptable in previous versions.

Fortunately though, envelope encryption was added in Grafana v8.3 behind a feature toggle. So, in case of emergency,
Grafana administrators will be able to downgrade up to Grafana v8.3 and enable envelope encryption as a workaround.

> **Note:** In Grafana releases between v8.3 and v8.5, you can turn envelope encryption on by adding the term
> `envelopeEncryption` to the list of feature toggles in your
> [Grafana configuration]({{< relref "../administration/configuration/#feature_toggles" >}}).

# Operational work

From the database encryption perspective, there are several operations that Grafana administrator may want to perform:

- [**Re-encrypt secrets**](#re-encrypt-secrets): re-encrypt secrets with envelope encryption and a fresh data key.
- [**Roll back secrets**](#roll-back-secrets): decrypt secrets encrypted with envelope encryption and re-encrypt them with legacy encryption.
- [**Re-encrypt data keys**](#re-encrypt-data-keys): re-encrypt data keys with a fresh key encryption key and a [KMS integration](#kms-integration).
- [**Rotate data keys**](#rotate-data-keys): disable active data keys and stop using them for encryption in favor of a fresh one.

Find more details about each of those below.

## Re-encrypt secrets

Secrets re-encryption can be performed when a Grafana administrator wants to either:

- Move forward already existing secrets' encryption from legacy to envelope encryption.
- Re-encrypt secrets after a [data keys rotation](#rotate-data-keys).

> **Note:** This operation is available through Grafana CLI by running `grafana-cli admin secrets-migration re-encrypt`
> command. It's safe to run more than once. Recommended to run under maintenance mode.

## Roll back secrets

Used to roll back secrets encrypted with envelope encryption to legacy encryption. It can be used to downgrade to
a Grafana version earlier than Grafana v9.0 after an unsuccessful upgrade.

> **Note:** This operation is available through Grafana CLI by running `grafana-cli admin secrets-migration rollback`
> command. It's safe to run more than once. Recommended to run under maintenance mode.

## Re-encrypt data keys

Used to re-encrypt data keys encrypted with a specific key encryption key (KEK). It can be used to either re-encrypt
existing data keys with a new key encryption key version (see [KMS integration](#kms-integration) rotation) or to
re-encrypt them with a completely different key encryption key.

> **Note:** This operation is available through Grafana CLI by running `grafana-cli admin secrets-migration re-encrypt-data-keys`
> command. It's safe to run more than once. Recommended to run under maintenance mode.

## Rotate data keys

Data keys rotation can be performed to disable the active data key and therefore stop using them for encryption operations.
For high-availability setups, you may need to wait until the data keys cache's TTL (time-to-live) expires to ensure that all
rotated data keys are no longer being used for encryption operations.

New data keys for encryption operations are generated on-demand.

> **Note:** It does not imply secrets re-encryption. Therefore, rotated data keys will continue being used to decrypt
> those secrets still encrypted with it. Look at [secrets re-encryption](#re-encrypt-secrets) to completely stop using
> rotated data keys for both encryption and decryption.

> **Note:** This operation is available through Grafana [Admin API]({{< relref "../developers/configuration/admin/#rotate-data-encryption-keys" >}}).
> It's safe to run more than once.

# KMS integration

With KMS integrations, you can choose to encrypt secrets stored in the Grafana database using a key from a KMS, which is a secure central storage location that is designed to help you to create and manage cryptographic keys and control their use across many services.

> **Note:** KMS integration is available in Grafana Enterprise. For more information, refer to [Enterprise Encryption]({{< relref "../enterprise/enterprise-encryption/_index.md" >}}) in Grafana Enterprise.
