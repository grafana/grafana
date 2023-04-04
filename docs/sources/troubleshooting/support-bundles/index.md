---
description: Learn how to send a support bundle to Grafana Labs support for troubleshooting
keywords:
  - grafana
  - troubleshooting
  - support
  - bundles
title: Send a support bundle to Grafana Labs support
menutitle: Send a support bundle to support
weight: 200
---

# Send a support bundle to Grafana Labs support

When you encounter problems with your Grafana instance, you can send us a support bundle that contains information about your Grafana instance, including:

- Grafana version
- Installed plugins
- Grafana configuration
- Deployed database information and migrations

## Available support bundle components

A support bundle can include any of the following components:

- **Usage statistics**: Usage statistic for the Grafana instance
- **User information**: A list of users of the Grafana instance
- **Database and Migration information**: Database information and migration log
- **Plugin information**: Plugin information for the Grafana instance
- **Basic information**: Basic information about the Grafana instance (version, memory usage, and so on)
- **Settings**: Settings for the Grafana instance
- **SAML**: Healthcheck connection and metadata for SAML (only displayed if SAML is enabled)
- **LDAP**: Healthcheck connection and metadata for LDAP (only displayed if LDAP is enabled)
- **OAuth2**: Healthcheck connection and metadata for each OAuth2 Provider supporter (only displayed if OAuth provider is enabled)

## Steps

To generate a support bundle and send the support bundle to Grafana Labs via a support ticket:

1. Click the Help icon.

1. Click **Support Bundles**.

   ![Support bundle panel](/static/img/docs/troubleshooting/support-bundle.png)

1. Click **New Support Bundle**.

1. Select the components that you want to include in the support bundle.

1. Click **Create**.

1. After the support bundle is ready, click **Download**.

   Grafana downloads the support bundle to an archive (tar.gz) file.

1. Attach the archive (tar.gz) file to a support ticket that you send to Grafana Labs Technical Support.

## Support bundle configuration

You can configure the following settings for support bundles:

```ini
# Enable support bundle creation (default: true)
enabled = true
# Only server admins can generate and view support bundles. When set to false, organization admins can generate and view support bundles (default: true)
server_admin_only = true
# If set, bundles will be encrypted with the provided public keys separated by whitespace
public_keys = ""
```

## Encrypting a support bundle

Support bundles can be encrypted with [age](age-encryption.org) before they are sent to
recipients. This is useful when you want to send a support bundle to Grafana through a
channel that is not private.

### Generate a key pair

Ensure [age](https://github.com/FiloSottile/age#installation) is installed on your system.

```bash
$ age-keygen -o key.txt
Public key: age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
```

### Support bundle encryption

Ensure [age](https://github.com/FiloSottile/age#installation) is installed on your system.

Add the public key to the `public_keys` setting in the `support_bundle` section of the Grafana configuration file.

```ini
[support_bundle]
public_keys = "age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p"
```

> Multiple public keys can be defined by separating them with whitespace.
> All included public keys will be able to decrypt the support bundle.

Example:

```ini
[support_bundle]
public_keys = "age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p age1yu8vzu554pv3klw46yhdv4raz36k5w3vy30lpxn46923lqngudyqvxacer"
```

When you restart Grafana, new support bundles will be encrypted with the provided
public keys. The support bundle file extension is `tar.gz.age`.

#### Decrypt a support bundle

Ensure [age](https://github.com/FiloSottile/age#installation) is installed on your system.

Execute the following command to decrypt the support bundle:

```bash
age --decrypt -i keyfile -o output.tar.gz downloaded.tar.gz.age
```

Example:

```bash
age --decrypt -i key.txt -o data.tar.gz af6684b4-d613-4b31-9fc3-7cb579199bea.tar.gz.age
```
