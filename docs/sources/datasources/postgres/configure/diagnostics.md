---
title: Common PostgreSQL connection issues
menuTitle: Common PostgreSQL connection issues
description: This document provides diagnostics / solutions while configuring the PostgreSQL data source
keywords:
  - grafana
  - postgresql
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
weight: 11
---

## Common Configuration issues

### Connection error

### Network error

#### connect: connection timed out

#### connect: connection refused

#### unknown error network unreachable

#### connect: network is unreachable

#### no such host

#### connect: no route to host

#### unknown error host unreachable

#### connection reset by peer

#### connect: no such file or directory

### Database error

#### Postgres error code: invalid_password

#### Postgres error code: invalid_authorization_specification

#### Postgres error code: internal_error

#### Postgres error code: invalid_catalog_name

#### Postgres error code: too_many_connections

#### Postgres error code: protocol_violation

### TLS error

#### found a certificate rather than a key in the PEM for the private key

#### x509: certificate signed by unknown authority

#### tls: private key does not match public key

#### certificate file doesn't exist

### Misc error

#### Access denied

#### Unexpected error

#### Unable to load datasource metadata
