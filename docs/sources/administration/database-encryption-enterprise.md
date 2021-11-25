+++
title = "Database encryption (Enterprise)"
description = "Grafana Enterprise database encryption"
keywords = ["grafana", "enterprise", "database", "encryption", "documentation"]
aliases = [""]
weight = 440
+++

# Grafana Enterprise database encryption

If you are using Grafana Enterprise, you can change Grafana’s cryptographic mode of operation from AES-CFB to AES-GCM, and integrate with a key management system (KMS) provider.

## Changing your encryption mode to AES-GCM

Grafana encrypts secrets using Advanced Encryption Standard in Cipher
FeedBack mode (AES-CFB). You might prefer to use AES in Galois/Counter
Mode (AES-GCM) instead, to meet your company’s security requirements or
in order to maintain consistency with other services.

To change your encryption mode, update the `algorithm` value in the
`[security.encryption]` section of your Grafana configuration file.
For details, refer to Enterprise configuration.
