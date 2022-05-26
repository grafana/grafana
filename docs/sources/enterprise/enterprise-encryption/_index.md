---
aliases:
  - ''
description: Grafana Enterprise database encryption
keywords:
  - grafana
  - enterprise
  - database
  - encryption
  - documentation
title: Enterprise database encryption
weight: 130
---

# Grafana Enterprise database encryption

If you are using Grafana Enterprise, you can integrate with a key management system (KMS) provider, and change Grafana’s cryptographic mode of operation from AES-CFB to AES-GCM.

## Encrypting your database with a key from a Key Management System (KMS)

You can choose to encrypt secrets stored in the Grafana database using a key from a KMS, which is a secure central storage location that is designed to help you to create and manage cryptographic keys and control their use across many services. When you integrate with a KMS, Grafana does not directly store your encryption key. Instead, Grafana stores KMS credentials and the identifier of the key, which Grafana uses to encrypt the database.

Grafana integrates with the following key management systems:

- [AWS KMS]({{< relref "using-aws-kms-to-encrypt-database-secrets.md" >}})
- [Azure Key Vault]({{< relref "using-azure-key-vault-to-encrypt-database-secrets.md" >}})
- [Google Cloud KMS]({{< relref "using-google-cloud-kms-to-encrypt-database-secrets.md" >}})
- [Hashicorp Key Vault]({{< relref "using-hashicorp-key-vault-to-encrypt-database-secrets.md" >}})

Refer to [Database encryption]({{< relref "../../administration/database-encryption.md" >}}) to learn more about how Grafana encrypts secrets in the database.

## Changing your encryption mode to AES-GCM

Grafana encrypts secrets using Advanced Encryption Standard in Cipher
FeedBack mode (AES-CFB). You might prefer to use AES in Galois/Counter
Mode (AES-GCM) instead, to meet your company’s security requirements or
in order to maintain consistency with other services.

To change your encryption mode, update the `algorithm` value in the
`[security.encryption]` section of your Grafana configuration file.
For details, refer to [Enterprise configuration]({{< relref "../enterprise-configuration.md#securityencryption" >}}).
