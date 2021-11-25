+++
title = "Database encryption"
description = "Grafana database encryption"
keywords = ["grafana", "database", "encryption", "documentation"]
aliases = [""]
weight = 450
+++

# Grafana database encryption

Grafana’s database contains secrets, which are used to query data sources, send alert notifications and perform other functions within Grafana.

Grafana encrypts these secrets before they are written to the database, by using a symmetric-key encryption algorithm called Advanced Encryption Standard (AES), and using a [secret key]({{< relref "../administration/configuration/#secret_key" >}}) that you can change when you configure a new Grafana instance.

You can also use envelope encryption, which complements a KMS integration by adding a layer of indirection to the encryption process.
