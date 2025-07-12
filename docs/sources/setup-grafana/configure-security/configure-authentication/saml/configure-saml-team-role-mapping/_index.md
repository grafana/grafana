---
description: Learn how to configure SAML authentication in Grafana's UI.
labels:
  products:
    - cloud
    - enterprise
menuTitle: Configure Role and Team sync for SAML
title: Configure Role and Team sync for SAML
weight: 540
---

# Configure team sync for SAML

{{< admonition type="note" >}}
Available in [Grafana Enterprise](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and [Grafana Cloud Advanced](https://grafana.com/docs/grafana-cloud/).
{{< /admonition >}}

To use SAML Team sync, set [`assertion_attribute_groups`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/enterprise-configuration/#assertion_attribute_groups) to the attribute name where you store user groups. Then Grafana will use attribute values extracted from SAML assertion to add user into the groups with the same name configured on the External group sync tab.

{{< admonition type="warning" >}}
Grafana requires the SAML groups attribute to be configured with distinct `AttributeValue` elements for each group. Do not include multiple groups within a single `AttributeValue` delimited by a comma or any other character. Failure to do so will prevent correct group parsing. Example:

```xml
<saml2:Attribute ...>
    <saml2:AttributeValue ...>admins_group</saml2:AttributeValue>
    <saml2:AttributeValue ...>division_1</saml2:AttributeValue>
</saml2:Attribute>
```

{{< /admonition >}}

{{< admonition type="note" >}}
Team Sync allows you sync users from SAML to Grafana teams. It does not automatically create teams in Grafana. You need to create teams in Grafana before you can use this feature.
{{< /admonition >}}

Given the following partial SAML assertion:

```xml
<saml2:Attribute
    Name="groups"
    NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified">
    <saml2:AttributeValue
        xmlns:xs="http://www.w3.org/2001/XMLSchema"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:type="xs:string">admins_group
    </saml2:AttributeValue>
    <saml2:AttributeValue
        xmlns:xs="http://www.w3.org/2001/XMLSchema"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:type="xs:string">division_1
    </saml2:AttributeValue>
</saml2:Attribute>
```

The configuration would look like this:

```ini
[auth.saml]
# ...
assertion_attribute_groups = groups
```

The following `External Group ID`s would be valid for input in the desired team's _External group sync_ tab:

- `admins_group`
- `division_1`

[Learn more about Team Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-team-sync/)

# Configure role sync for SAML

Role sync allows you to map user roles from an identity provider to Grafana. To enable role sync, configure role attribute and possible values for the Editor, Admin, and Grafana Admin roles. For more information about user roles, refer to [Roles and permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/).

1. In the configuration file, set [`assertion_attribute_role`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/enterprise-configuration/#assertion_attribute_role) option to the attribute name where the role information will be extracted from.
1. Set the [`role_values_none`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/enterprise-configuration/#role_values_none) option to the values mapped to the `None` role.
1. Set the [`role_values_viewer`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/enterprise-configuration/#role_values_viewer) option to the values mapped to the `Viewer` role.
1. Set the [`role_values_editor`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/enterprise-configuration/#role_values_editor) option to the values mapped to the `Editor` role.
1. Set the [`role_values_admin`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/enterprise-configuration/#role_values_admin) option to the values mapped to the organization `Admin` role.
1. Set the [`role_values_grafana_admin`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/enterprise-configuration/#role_values_grafana_admin) option to the values mapped to the `Grafana Admin` role.

If a user role doesn't match any of configured values, then the role specified by the `auto_assign_org_role` configuration option will be assigned. If the `auto_assign_org_role` field is not set then the user role will default to `Viewer`.

For more information about roles and permissions in Grafana, refer to [Roles and permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/).

Example configuration:

```ini
[auth.saml]
assertion_attribute_role = role
role_values_none = none
role_values_viewer = external
role_values_editor = editor, developer
role_values_admin = admin, operator
role_values_grafana_admin = superadmin
```

**Important**: When role sync is configured, any changes of user roles and organization membership made manually in Grafana will be overwritten on next user login. Assign user organizations and roles in the IdP instead.

If you don't want user organizations and roles to be synchronized with the IdP, you can use the `skip_org_role_sync` configuration option.

Example configuration:

```ini
[auth.saml]
skip_org_role_sync = true
```
