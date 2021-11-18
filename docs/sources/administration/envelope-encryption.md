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

**> Note:** Back up your database before turning on envelope encryption for the first time. After you have turned envelope encryption on, avoid turning it off. You will experience errors if you:
1. Turn envelope encryption on.
2. Create new secrets or update your existing secrets (for example, by creating a new data source or alert notification channel).
3. Turn envelope encryption off.

The data sources, alert notification channels, and other resources that are using envelope encryption will stop working, because the secrets that are encrypted with envelope encryption cannot be decrypted or used by Grafana when envelope encryption is turned off.
