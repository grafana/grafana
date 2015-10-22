---
page_title: LDAP Integration
page_description: LDAP Integration guide for Grafana.
page_keywords: grafana, ldap, configuration, documentation, integration
---

# LDAP Integration

Grafana 2.1 ships with a strong LDAP integration feature. The LDAP integration in Grafana allows your
Grafana users to login with their LDAP credentials. You can also specify mappings between LDAP
group memberships and Grafana Organization user roles.

## Configuration
You turn on LDAP in the [main config file](../configuration/#authldap) as well as specify the path to the LDAP
specific configuration file (default: `/etc/grafana/ldap.toml`).

### Example config

```toml
# Set to true to log user information returned from LDAP
verbose_logging = false

[[servers]]
# LDAP server host
host = "127.0.0.1"
# Usual port is 389, or, if TLS is supported, 636
port = 389
# Set to true if LDAP server supports TLS
use_ssl = false
# set to true if you want to skip SSL cert validation
ssl_skip_verify = false

# Search user bind dn
bind_dn = "cn=admin,dc=grafana,dc=org"
# Search user bind password
bind_password = "grafana"

# Search filter, for example "(cn=%s)" or "(sAMAccountName=%s)"
search_filter = "(cn=%s)"
# An array of base dns to search through
search_base_dns = ["dc=grafana,dc=org"]

# Map LDAP user attributes to Grafana user attributes
[servers.attributes]
name = "givenName"
surname = "sn"
username = "cn"
member_of = "memberOf"
email =  "email"

# Map LDAP groups to Grafana org roles
[[servers.group_mappings]]
group_dn = "cn=admins,dc=grafana,dc=org"
org_role = "Admin"
# The Grafana organization database id, optional, if left out, the default org (id 1) will be used
# org_id = 1

[[servers.group_mappings]]
group_dn = "cn=users,dc=grafana,dc=org"
org_role = "Editor"

[[servers.group_mappings]]
# If you want to match all (or no LDAP groups) then you can use wildcard
group_dn = "*"
org_role = "Viewer"
```

## Bind & Bind Password

By default the configuration expects you to specify a bind DN and bind password. This should be a read only user that can perform LDAP searches.
When the user DN is found a second bind is performed with the user provided username & password (in the normal Grafana login form).

```
bind_dn = "cn=admin,dc=grafana,dc=org"
bind_password = "grafana"
```

### Single Bind Example

If you can provide a single bind expression that matches all possible users, you can skip the second bind and bind against the user DN directly.
This allows you to not specify a bind_password in the configuration file.

```
bind_dn = "cn=%s,o=users,dc=grafana,dc=org"
```

In this case you skip providing a `bind_password` and instead provide a `bind_dn` value with a `%s` somewhere. This will be replaced with the username entered in on the Grafana login page.
The search filter and search bases settings are still needed to perform the LDAP search to retrieve the other LDAP information (like LDAP groups and email).

## LDAP to Grafana Org Role Sync

## Group Mappings
In `[[servers.group_mappings]]` you can map an LDAP group to a Grafana organization and role. These will be synced every time the user logs in, with LDAP being the authoritative source.
So, if you change a user's role in the Grafana Org. Users page, this change will be reset the next time the user logs in. If you change the LDAP groups of a user, the change will take effect the next time the user logs in.

### Priority between Multiple Mappings
The first group mapping that an LDAP user is matched to will be used for the sync. If you have LDAP users that fit multiple mappings, the topmost mapping in the TOML config will be used.

## Ldap to Grafana Org Role Sync
In the `[[servers.group_mappings]]` you can map a LDAP group to a grafana organization and role. These will be synced every time the user logs in. So
if you change a users role in the Grafana Org. Users page, this change will be reset the next time the user logs in. Similarly if you
can LDAP groups for a user in LDAP the change will take effect the next time the user logs in to Grafana.

