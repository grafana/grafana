+++
title = "KMS integration"
description = ""
keywords = ["grafana", "kms", "key management system integration"]
weight = 1200
+++

# Key management systems (KMSs)

You can choose to encrypt secrets stored in the Grafana database using a key from a KMS, which is a secure central storage location that is designed to help you to create and manage cryptographic keys and control their use across many services. When you integrate with a KMS, Grafana does not directly store your encryption key. Instead, Grafana stores KMS credentials and the identifier of the key, which Grafana uses to encrypt the database.

Grafana integrates with the following key management systems:

- [AWS KMS]({{< relref "./using-aws-kms-to-encrypt-database-secrets.md" >}})
- [Azure Key Vault]({{< relref "./using-azure-key-vault-to-encrypt-database-secrets.md" >}})

Refer to [Database encryption]({{< relref "../../administration/database-encryption.md" >}}) to learn more about how Grafana encrypts secrets in the database.
