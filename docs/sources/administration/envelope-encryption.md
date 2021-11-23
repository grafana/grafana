+++
title = "Envelope encryption"
description = "Envelope encryption"
keywords = ["grafana", "envelope encryption", "documentation"]
aliases = [""]
weight = 430
+++

# Envelope encryption

In Grafana, you can choose to use envelope encryption. Instead of
encrypting all secrets with a single key, Grafana uses a set of keys
called data encryption keys (DEKs) to encrypt them. These data
encryption keys are themselves encrypted with a single key encryption
key (KEK).

To turn on envelope encryption, add the term `envelopeEncryption` to the list of feature toggles in your [Grafana configuration]({{< relref "../administration/configuration/#feature_toggles" >}}).

**> Note:** Avoid turning off envelope encryption once you have turned it on, and back up your database before turning it on for the first time. If you turn envelope encryption on, create new secrets or update your existing secrets (for example, by creating a new data source or alert notification channel), and then turn envelope encryption off, then those data sources, alert notification channels, and other resources using envelope encryption will stop working and you will experience errors. This is because the secrets encrypted with envelope encryption cannot be decrypted or used by Grafana when envelope encryption is turned off.
