---
aliases:
  - ../../../auth/enhanced-ldap/
description: Learn about configuring LDAP authentication in Grafana using the Grafana UI.
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: LDAP user interface
title: Configure LDAP authentication using the Grafana user interface
weight: 300
---

# Configure LDAP authentication using the Grafana user interface

This page explains how to configure LDAP authentication in Grafana using the Grafana user interface. For more detailed information about configuring LDAP authentication using the configuration file, refer to [LDAP authentication](../ldap/).

Benefits of using the Grafana user interface to configure LDAP authentication include:

- There is no need to edit the configuration file manually.
- Quickly test the connection to the LDAP server.
- There is no need to restart Grafana after making changes.

{{% admonition type="note" %}}
Any configuration changes made through the Grafana user interface (UI) will take precedence over settings specified in the Grafana configuration file or through environment variables. If you modify any configuration settings in the UI, they will override any corresponding settings set via environment variables or defined in the configuration file.
{{% /admonition %}}

## Before you begin

Prerequisites:

- Knowledge of LDAP authentication and how it works.
- Grafana instance v11.3.0 or later.
- Permissions `settings:read` and `settings:write` with `settings:auth.ldap:*` scope.
- This feature requires the `ssoSettingsLDAP` feature toggle to be enabled.

## Steps to configure LDAP authentication

Sign in to Grafana and navigate to **Administration > Authentication > LDAP**.

### 1. Complete mandatory fields

The mandatory fields have an asterisk (**\***) next to them. Complete the following fields:

1. **Server host**: Host name or IP address of the LDAP server.
1. **Search filter**: The LDAP search filter finds entries within the directory.
1. **Search base DNS**: List of base DNs to search through.

### 2. Complete optional fields

Complete the optional fields as needed:

1. **Bind DN**: Distinguished name (DN) of the user to bind to.
1. **Bind password**: Password for the server.

### 3. Advanced settings

Click the **Edit** button in the **Advanced settings** section to configure the following settings:

#### 1. Miscellaneous settings

Complementary settings for LDAP authentication.

1. **Allow sign-up**: Allows new users to register upon logging in.
1. **Port**: Port number of the LDAP server. The default is 389.
1. **Timeout**: Time in seconds to wait for a response from the LDAP server.

#### 2. Attributes

Attributes used to map LDAP user assertion to Grafana user attributes.

1. **Name**: Name of the assertion attribute to map to the Grafana user name.
1. **Surname**: Name of the assertion attribute to map to the Grafana user surname.
1. **Username**: Name of the assertion attribute to map to the Grafana user username.
1. **Member Of**: Name of the assertion attribute to map to the Grafana user membership.
1. **Email**: Name of the assertion attribute to map to the Grafana user email.

#### 3. Group mapping

Map LDAP groups to Grafana roles.

1. **Skip organization role sync**: This option avoids syncing organization roles. It is useful when you want to manage roles manually.
1. **Group search filter**: The LDAP search filter finds groups within the directory.
1. **Group search base DNS**: List of base DNS to specify the matching groups' locations.
1. **Group name attribute**: Identifies users within group entries.
1. **Manage group mappings**:

   When managing group mappings, the following fields will become available. To add a new group mapping, click the **Add group mapping** button.

   1. **Add a group DN mapping**: The name of the key used to extract the ID token.
   1. **Add an organization role mapping**: Select the Basic Role mapped to this group.
   1. **Add the organization ID membership mapping**: Map the group to an organization ID.
   1. **Define Grafana Admin membership**: Enable Grafana Admin privileges to the group.

#### 4. Extra security settings

Additional security settings options for LDAP authentication.

1. **Enable SSL**: This option will enable SSL to connect to the LDAP server.
1. **Start TLS**: Use StartTLS to secure the connection to the LDAP server.
1. **Min TLS version**: Choose the minimum TLS version to use. TLS1.2 or TLS1.3
1. **TLS ciphers**: List the ciphers to use for the connection. For a complete list of ciphers, refer to the [Cipher Go library](https://go.dev/src/crypto/tls/cipher_suites.go).
1. **Encryption key and certificate provision specification**:
   This section allows you to specify the key and certificate for the LDAP server. You can provide the key and certificate in two ways: **base-64** encoded or **path to files**.
   1. **Base-64 encoded certificate**:
      All values used in this section must be base-64 encoded.
      1. **Root CA certificate content**: List of root CA certificates.
      1. **Client certificate content**: Client certificate content.
      1. **Client key content**: Client key content.
   1. **Path to files**:
      Path in the file system to the key and certificate files
      1. **Root CA certificate path**: Path to the root CA certificate.
      1. **Client certificate path**: Path to the client certificate.
      1. **Client key path**: Path to the client key.

### 4. Persisting the configuration

Once you have configured the LDAP settings, click **Save** to persist the configuration.

If you want to delete all the changes made through the UI and revert to the configuration file settings, click the three dots menu icon and click **Reset to default values**.
