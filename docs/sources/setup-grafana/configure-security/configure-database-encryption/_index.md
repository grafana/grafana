---
aliases:
  - ../../administration/database-encryption/
  - ../../enterprise/enterprise-encryption/
description: If you have a Grafana Enterprise license, you can integrate with a variety
  of key management system providers.
title: Configure database encryption
weight: 700
---

# Configure database encryption

Grafana’s database contains secrets, which are used to query data sources, send alert notifications, and perform other functions within Grafana.

Grafana encrypts these secrets before they are written to the database, by using a symmetric-key encryption algorithm called Advanced Encryption Standard (AES). These secrets are signed using a [secret key]({{< relref "../../configure-grafana/#secret_key" >}}) that you can change when you configure a new Grafana instance.

> **Note:** Grafana v9.0 and newer use [envelope encryption](#envelope-encryption) by default, which adds a layer of indirection to the encryption process that introduces an [**implicit breaking change**](#implicit-breaking-change) for older versions of Grafana.

For further details about how to operate a Grafana instance with envelope encryption, see the [Operational work]({{< relref "./#operational-work" >}}) section.

> **Note:** In Grafana Enterprise, you can also [encrypt secrets in AES-GCM (Galois/Counter Mode)]({{< relref "#changing-your-encryption-mode-to-aes-gcm" >}}) instead of the default AES-CFB (Cipher FeedBack mode).

## Envelope encryption

> **Note:** Since Grafana v9.0, you can turn envelope encryption off by adding the feature toggle `disableEnvelopeEncryption` to your [Grafana configuration]({{< relref "../../configure-grafana/#feature_toggles" >}}).

Instead of encrypting all secrets with a single key, Grafana uses a set of keys called data encryption keys (DEKs) to encrypt them. These data encryption keys are themselves encrypted with a single key encryption key (KEK), configured through the `secret_key` attribute in your
[Grafana configuration]({{< relref "../../configure-grafana/#secret_key" >}}) or with a [key management service (KMS) integration](#kms-integration).

### Implicit breaking change

Envelope encryption introduces an implicit breaking change to versions of Grafana prior to v9.0, because it changes how secrets stored in the Grafana database are encrypted. Grafana administrators can upgrade to Grafana v9.0 with no action required from the database encryption perspective, but must be extremely careful if they need to roll an upgrade back to Grafana v8.5 or earlier because secrets created or modified after upgrading to Grafana v9.0 can’t be decrypted by previous versions.

Grafana v8.5 implemented envelope encryption behind an optional feature toggle. Grafana administrators who need to downgrade to Grafana v8.5 can enable envelope encryption as a workaround by adding the feature toggle `envelopeEncryption` to the [Grafana configuration]({{< relref "../../configure-grafana/#feature_toggles" >}}).

## Operational work

From the database encryption perspective, Grafana administrators can:

- [**Re-encrypt secrets**](#re-encrypt-secrets): re-encrypt secrets with envelope encryption and a fresh data key.
- [**Roll back secrets**](#roll-back-secrets): decrypt secrets encrypted with envelope encryption and re-encrypt them with legacy encryption.
- [**Re-encrypt data keys**](#re-encrypt-data-keys): re-encrypt data keys with a fresh key encryption key and a [KMS integration](#kms-integration).
- [**Rotate data keys**](#rotate-data-keys): disable active data keys and stop using them for encryption in favor of a fresh one.

### Re-encrypt secrets

You can re-encrypt secrets in order to:

- Move already existing secrets' encryption forward from legacy to envelope encryption.
- Re-encrypt secrets after a [data keys rotation](#rotate-data-keys).

To re-encrypt secrets, use the [Grafana CLI]({{< relref "../../../cli/" >}}) by running the `grafana cli admin secrets-migration re-encrypt` command or the `/encryption/reencrypt-secrets` endpoint of the Grafana [Admin API]({{< relref "../../../developers/http_api/admin/#roll-back-secrets" >}}). It's safe to run more than once, more recommended under maintenance mode.

### Roll back secrets

You can roll back secrets encrypted with envelope encryption to legacy encryption. This might be necessary to downgrade to Grafana versions prior to v9.0 after an unsuccessful upgrade.

To roll back secrets, use the [Grafana CLI]({{< relref "../../../cli/" >}}) by running the `grafana cli admin secrets-migration rollback` command or the `/encryption/rollback-secrets` endpoint of the Grafana [Admin API]({{< relref "../../../developers/http_api/admin/#re-encrypt-secrets" >}}). It's safe to run more than once, more recommended under maintenance mode.

### Re-encrypt data keys

You can re-encrypt data keys encrypted with a specific key encryption key (KEK). This allows you to either re-encrypt existing data keys with a new KEK version (see [KMS integration](#kms-integration) rotation) or to re-encrypt them with a completely different KEK.

To re-encrypt data keys, use the [Grafana CLI]({{< relref "../../../cli/" >}}) by running the `grafana cli admin secrets-migration re-encrypt-data-keys` command or the `/encryption/reencrypt-data-keys` endpoint of the Grafana [Admin API]({{< relref "../../../developers/http_api/admin/#re-encrypt-data-encryption-keys" >}}). It's safe to run more than once, more recommended under maintenance mode.

### Rotate data keys

You can rotate data keys to disable the active data key and therefore stop using them for encryption operations. For high-availability setups, you might need to wait until the data keys cache's time-to-live (TTL) expires to ensure that all rotated data keys are no longer being used for encryption operations.

New data keys for encryption operations are generated on demand.

> **Note:** Data key rotation does **not** implicitly re-encrypt secrets. Grafana will continue to use rotated data keys to decrypt
> secrets still encrypted with them. To completely stop using
> rotated data keys for both encryption and decryption, see [secrets re-encryption](#re-encrypt-secrets).

To rotate data keys, use the `/encryption/rotate-data-keys` endpoint of the Grafana [Admin API]({{< relref "../../../developers/http_api/admin/#rotate-data-encryption-keys" >}}). It's safe to call more than once, more recommended under maintenance mode.

## Encrypting your database with a key from a key management service (KMS)

If you are using Grafana Enterprise, you can integrate with a key management service (KMS) provider, and change Grafana’s cryptographic mode of operation from AES-CFB to AES-GCM.

You can choose to encrypt secrets stored in the Grafana database using a key from a KMS, which is a secure central storage location that is designed to help you to create and manage cryptographic keys and control their use across many services. When you integrate with a KMS, Grafana does not directly store your encryption key. Instead, Grafana stores KMS credentials and the identifier of the key, which Grafana uses to encrypt the database.

Grafana integrates with the following key management services:

- [AWS KMS]({{< relref "encrypt-secrets-using-aws-kms/" >}})
- [Azure Key Vault]({{< relref "encrypt-secrets-using-azure-key-vault/" >}})
- [Google Cloud KMS]({{< relref "encrypt-secrets-using-google-cloud-kms/" >}})
- [Hashicorp Key Vault]({{< relref "encrypt-secrets-using-hashicorp-key-vault/" >}})

## Changing your encryption mode to AES-GCM

Grafana encrypts secrets using Advanced Encryption Standard in Cipher FeedBack mode (AES-CFB). You might prefer to use AES in Galois/Counter Mode (AES-GCM) instead, to meet your company’s security requirements or in order to maintain consistency with other services.

To change your encryption mode, update the `algorithm` value in the `[security.encryption]` section of your Grafana configuration file. For further details, refer to [Enterprise configuration]({{< relref "../../configure-grafana/enterprise-configuration#securityencryption" >}}).
