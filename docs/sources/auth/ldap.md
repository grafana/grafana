+++
title = "LDAP Authentication"
description = "Grafana LDAP Authentication Guide "
keywords = ["grafana", "configuration", "documentation", "ldap", "active directory"]
type = "docs"
aliases = ["/installation/ldap/"]
[menu.docs]
name = "LDAP"
identifier = "ldap"
parent = "authentication"
weight = 2
+++

# LDAP Authentication

The LDAP integration in Grafana allows your Grafana users to login with their LDAP credentials. You can also specify mappings between LDAP
group memberships and Grafana Organization user roles.

## Supported LDAP Servers

Grafana uses a [third-party LDAP library](https://github.com/go-ldap/ldap) under the hood that supports basic LDAP v3 functionality.
This means that you should be able to configure LDAP integration using any compliant LDAPv3 server, for example [OpenLDAP](#openldap) or
[Active Directory](#active-directory) among [others](https://en.wikipedia.org/wiki/Directory_service#LDAP_implementations).

## Enable LDAP

In order to use LDAP integration you'll first need to enable LDAP in the [main config file]({{< relref "installation/configuration.md" >}}) as well as specify the path to the LDAP
specific configuration file (default: `/etc/grafana/ldap.toml`).

```bash
[auth.ldap]
# Set to `true` to enable LDAP integration (default: `false`)
enabled = true

# Path to the LDAP specific configuration file (default: `/etc/grafana/ldap.toml`)
config_file = /etc/grafana/ldap.toml

# Allow sign up should almost always be true (default) to allow new Grafana users to be created (if ldap authentication is ok). If set to
# false only pre-existing Grafana users will be able to login (if ldap authentication is ok).
allow_sign_up = true
```

## Grafana LDAP Configuration

Depending on which LDAP server you're using and how that's configured your Grafana LDAP configuration may vary.
See [configuration examples](#configuration-examples) for more information.

**LDAP specific configuration file (ldap.toml) example:**
```bash
[[servers]]
# Ldap server host (specify multiple hosts space separated)
host = "127.0.0.1"
# Default port is 389 or 636 if use_ssl = true
port = 389
# Set to true if ldap server supports TLS
use_ssl = false
# Set to true if connect ldap server with STARTTLS pattern (create connection in insecure, then upgrade to secure connection with TLS)
start_tls = false
# set to true if you want to skip ssl cert validation
ssl_skip_verify = false
# set to the path to your root CA certificate or leave unset to use system defaults
# root_ca_cert = "/path/to/certificate.crt"
# Authentication against LDAP servers requiring client certificates
# client_cert = "/path/to/client.crt"
# client_key = "/path/to/client.key"

# Search user bind dn
bind_dn = "cn=admin,dc=grafana,dc=org"
# Search user bind password
# If the password contains # or ; you have to wrap it with triple quotes. Ex """#password;"""
bind_password = 'grafana'

# User search filter, for example "(cn=%s)" or "(sAMAccountName=%s)" or "(uid=%s)"
# Allow login from email or username, example "(|(sAMAccountName=%s)(userPrincipalName=%s))"
search_filter = "(cn=%s)"

# An array of base dns to search through
search_base_dns = ["dc=grafana,dc=org"]

# group_search_filter = "(&(objectClass=posixGroup)(memberUid=%s))"
# group_search_filter_user_attribute = "distinguishedName"
# group_search_base_dns = ["ou=groups,dc=grafana,dc=org"]

# Specify names of the ldap attributes your ldap uses
[servers.attributes]
name = "givenName"
surname = "sn"
username = "cn"
member_of = "memberOf"
email =  "email"
```

### Bind

#### Bind & Bind Password

By default the configuration expects you to specify a bind DN and bind password. This should be a read only user that can perform LDAP searches.
When the user DN is found a second bind is performed with the user provided username & password (in the normal Grafana login form).

```bash
bind_dn = "cn=admin,dc=grafana,dc=org"
bind_password = "grafana"
```

#### Single Bind Example

If you can provide a single bind expression that matches all possible users, you can skip the second bind and bind against the user DN directly.
This allows you to not specify a bind_password in the configuration file.

```bash
bind_dn = "cn=%s,o=users,dc=grafana,dc=org"
```

In this case you skip providing a `bind_password` and instead provide a `bind_dn` value with a `%s` somewhere. This will be replaced with the username entered in on the Grafana login page.
The search filter and search bases settings are still needed to perform the LDAP search to retrieve the other LDAP information (like LDAP groups and email).

### POSIX schema
If your ldap server does not support the memberOf attribute add these options:

```bash
## Group search filter, to retrieve the groups of which the user is a member (only set if memberOf attribute is not available)
group_search_filter = "(&(objectClass=posixGroup)(memberUid=%s))"
## An array of the base DNs to search through for groups. Typically uses ou=groups
group_search_base_dns = ["ou=groups,dc=grafana,dc=org"]
## the %s in the search filter will be replaced with the attribute defined below
group_search_filter_user_attribute = "uid"
```

Also set `member_of = "dn"` in the `[servers.attributes]` section.

### Group Mappings

In `[[servers.group_mappings]]` you can map an LDAP group to a Grafana organization and role.  These will be synced every time the user logs in, with LDAP being
the authoritative source. So, if you change a user's role in the Grafana Org. Users page, this change will be reset the next time the user logs in. If you
change the LDAP groups of a user, the change will take effect the next time the user logs in.

The first group mapping that an LDAP user is matched to will be used for the sync. If you have LDAP users that fit multiple mappings, the topmost mapping in the
TOML config will be used.

**LDAP specific configuration file (ldap.toml) example:**
```bash
[[servers]]
# other settings omitted for clarity

[[servers.group_mappings]]
group_dn = "cn=superadmins,dc=grafana,dc=org"
org_role = "Admin"
grafana_admin = true # Available in Grafana v5.3 and above

[[servers.group_mappings]]
group_dn = "cn=admins,dc=grafana,dc=org"
org_role = "Admin"

[[servers.group_mappings]]
group_dn = "cn=users,dc=grafana,dc=org"
org_role = "Editor"

[[servers.group_mappings]]
group_dn = "*"
org_role = "Viewer"
```

Setting | Required | Description | Default
------------ | ------------ | ------------- | -------------
`group_dn` | Yes | LDAP distinguished name (DN) of LDAP group. If you want to match all (or no LDAP groups) then you can use wildcard (`"*"`) |
`org_role` | Yes | Assign users of `group_dn` the organization role `"Admin"`, `"Editor"` or `"Viewer"` |
`org_id` | No | The Grafana organization database id. Setting this allows for multiple group_dn's to be assigned to the same `org_role` provided the `org_id` differs | `1` (default org id)
`grafana_admin` | No | When `true` makes user of `group_dn` Grafana server admin. A Grafana server admin has admin access over all organizations and users. Available in Grafana v5.3 and above | `false`

### Nested/recursive group membership

Users with nested/recursive group membership must have an LDAP server that supports `LDAP_MATCHING_RULE_IN_CHAIN`
and configure `group_search_filter` in a way that it returns the groups the submitted username is a member of.

**Active Directory example:**

Active Directory groups store the Distinguished Names (DNs) of members, so your filter will need to know the DN for the user based only on the submitted username.
Multiple DN templates can be searched by combining filters with the LDAP OR-operator. Examples:

```bash
group_search_filter = "(member:1.2.840.113556.1.4.1941:=CN=%s,[user container/OU])"
group_search_filter = "(|(member:1.2.840.113556.1.4.1941:=CN=%s,[user container/OU])(member:1.2.840.113556.1.4.1941:=CN=%s,[another user container/OU]))"
group_search_filter_user_attribute = "cn"
```
For more information on AD searches see [Microsoft's Search Filter Syntax](https://docs.microsoft.com/en-us/windows/desktop/adsi/search-filter-syntax) documentation.

For troubleshooting, by changing `member_of` in `[servers.attributes]` to "dn" it will show you more accurate group memberships when [debug is enabled](#troubleshooting).

## Configuration examples

### OpenLDAP

[OpenLDAP](http://www.openldap.org/) is an open source directory service.

**LDAP specific configuration file (ldap.toml):**
```bash
[[servers]]
host = "127.0.0.1"
port = 389
use_ssl = false
start_tls = false
ssl_skip_verify = false
bind_dn = "cn=admin,dc=grafana,dc=org"
bind_password = 'grafana'
search_filter = "(cn=%s)"
search_base_dns = ["dc=grafana,dc=org"]

[servers.attributes]
name = "givenName"
surname = "sn"
username = "cn"
member_of = "memberOf"
email =  "email"

# [[servers.group_mappings]] omitted for clarity
```

### Multiple LDAP servers

Grafana does support receiving information from multiple LDAP servers.

**LDAP specific configuration file (ldap.toml):**
```bash
# --- First LDAP Server ---

[[servers]]
host = "10.0.0.1"
port = 389
use_ssl = false
start_tls = false
ssl_skip_verify = false
bind_dn = "cn=admin,dc=grafana,dc=org"
bind_password = 'grafana'
search_filter = "(cn=%s)"
search_base_dns = ["ou=users,dc=grafana,dc=org"]

[servers.attributes]
name = "givenName"
surname = "sn"
username = "cn"
member_of = "memberOf"
email =  "email"

[[servers.group_mappings]]
group_dn = "cn=admins,ou=groups,dc=grafana,dc=org"
org_role = "Admin"
grafana_admin = true

# --- Second LDAP Server ---

[[servers]]
host = "10.0.0.2"
port = 389
use_ssl = false
start_tls = false
ssl_skip_verify = false

bind_dn = "cn=admin,dc=grafana,dc=org"
bind_password = 'grafana'
search_filter = "(cn=%s)"
search_base_dns = ["ou=users,dc=grafana,dc=org"]

[servers.attributes]
name = "givenName"
surname = "sn"
username = "cn"
member_of = "memberOf"
email =  "email"

[[servers.group_mappings]]
group_dn = "cn=editors,ou=groups,dc=grafana,dc=org"
org_role = "Editor"

[[servers.group_mappings]]
group_dn = "*"
org_role = "Viewer"
```

### Active Directory

[Active Directory](https://technet.microsoft.com/en-us/library/hh831484(v=ws.11).aspx) is a directory service which is commonly used in Windows environments.

Assuming the following Active Directory server setup:

* IP address: `10.0.0.1`
* Domain: `CORP`
* DNS name: `corp.local`

**LDAP specific configuration file (ldap.toml):**
```bash
[[servers]]
host = "10.0.0.1"
port = 3269
use_ssl = true
start_tls = false
ssl_skip_verify = true
bind_dn = "CORP\\%s"
search_filter = "(sAMAccountName=%s)"
search_base_dns = ["dc=corp,dc=local"]

[servers.attributes]
name = "givenName"
surname = "sn"
username = "sAMAccountName"
member_of = "memberOf"
email =  "mail"

# [[servers.group_mappings]] omitted for clarity
```



#### Port requirements

In above example SSL is enabled and an encrypted port have been configured. If your Active Directory don't support SSL please change `enable_ssl = false` and `port = 389`.
Please inspect your Active Directory configuration and documentation to find the correct settings. For more information about Active Directory and port requirements see [link](https://technet.microsoft.com/en-us/library/dd772723(v=ws.10)).

## Troubleshooting

To troubleshoot and get more log info enable ldap debug logging in the [main config file]({{< relref "installation/configuration.md" >}}).

```bash
[log]
filters = ldap:debug
```
