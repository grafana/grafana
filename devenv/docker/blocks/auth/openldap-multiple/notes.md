# Notes on Multiple OpenLdap Docker Block

This is very similar to openldap docker block, but it creates multiple ldap servers instead of one.

Any ldif files added to the prepopulate subdirectory will be automatically imported into the OpenLdap database.

"admins-ldap-server" block contains admin group and admin users. The "ldap-server" block has all the rest of the users. See below for the full list of users.

This blocks are here to help with testing multiple LDAP servers, for any other LDAP related development and testing "openldap" block should be used.

## Enabling LDAP in Grafana

Copy the ldap_dev.toml file in this folder into your `conf` folder (it is gitignored already). To enable it in the .ini file to get Grafana to use this block:

```ini
[auth.ldap]
enabled = true
config_file = conf/ldap_dev.toml
; allow_sign_up = true
```

## Groups & Users

admins
  ldap-admin
  ldap-torkel
backend
  ldap-carl
  ldap-torkel
  ldap-leo
frontend
  ldap-torkel
  ldap-tobias
  ldap-daniel
editors
  ldap-editor
no groups
  ldap-viewer
