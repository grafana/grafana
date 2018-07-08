# Notes on OpenLdap Docker Block

Any ldif files added to the prepopulate subdirectory will be automatically imported into the OpenLdap database.

The ldif files add three users, `ldapviewer`, `ldapeditor` and `ldapadmin`. Two groups, `admins` and `users`, are added that correspond with the group mappings in the default conf/ldap.toml. `ldapadmin` is a member of `admins` and `ldapeditor` is a member of `users`.

Note that users that are added here need to specify a `memberOf` attribute manually as well as the `member` attribute for the group. The `memberOf` module usually does this automatically (if you add a group in Apache Directory Studio for example) but this does not work in the entrypoint script as it uses the `slapadd` command to add entries before the server has started and before the `memberOf` module is loaded.

After adding ldif files to `prepopulate`:

1. Remove your current docker image: `docker rm docker_openldap_1`
2. Build: `docker-compose build`
3. `docker-compose up`

## Enabling LDAP in Grafana

The default `ldap.toml` file in `conf` has host set to `127.0.0.1` and port to set to 389 so all you need to do is enable it in the .ini file to get Grafana to use this block:

```ini
[auth.ldap]
enabled = true
config_file = conf/ldap.toml
; allow_sign_up = true
```

Test groups & users

admins
  ldap-admin
  ldap-torkel
  ldap-daniel
backend
  ldap-carl
  ldap-torkel
  ldap-leo
frontend
  ldap-torkel
  ldap-tobias
  ldap-daniel
editors
  ldap-editors


no groups
  ldap-viewer



