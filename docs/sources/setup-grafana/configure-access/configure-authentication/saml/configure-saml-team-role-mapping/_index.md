---
aliases:
  - ../../../configure-access/configure-authentication/saml/configure-saml-team-role-mapping/ # /docs/grafana/next/configure-access/configure-authentication/saml/configure-saml-team-role-mapping/
  - ../../../configure-security/configure-authentication/setup-grafana/configure-security/configure-authentication/saml/configure-saml-team-role-mapping/ # /docs/grafana/next/setup-grafana/configure-security/configure-authentication/setup-grafana/configure-security/configure-authentication/saml/configure-saml-team-role-mapping/
  - ../../../configure-security/configure-authentication/saml/configure-saml-team-role-mapping/ # /docs/grafana/next/setup-grafana/configure-security/configure-authentication/saml/configure-saml-team-role-mapping/
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
Available in [Grafana Enterprise](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and to customers on select Grafana Cloud plans. For pricing information, visit [pricing](https://grafana.com/pricing/) or contact our sales team.
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

[Learn more about Team Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-team-sync/)

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

## Configure role sync with Okta

This section shows how to configure Okta to send group memberships in the SAML assertion, then use those groups to assign roles in Grafana.

### Step 1: Configure Okta to send groups

1. In Okta Admin, go to **Applications** > **Applications** and open your Grafana SAML app.
1. Open the **Sign On** tab, then click **Edit** in the SAML 2.0 section.
1. Scroll to **GROUP ATTRIBUTE STATEMENTS**.
1. Add a group attribute with the following settings:

   | Field      | Value                      |
   | ---------- | -------------------------- |
   | **Name**   | `Group`                    |
   | **Filter** | Matches regular expression |
   | **Value**  | `.*`                       |

1. Click **Save**.

This configuration sends all Okta groups the user belongs to in the SAML assertion under the `Group` attribute.

{{< admonition type="note" >}}
To send only specific groups, change the regular expression filter. For example, `grafana-.*` sends only groups starting with `grafana-`.
{{< /admonition >}}

### Step 2: Configure Grafana to map groups to roles

Use the group attribute for role assignment by setting `assertion_attribute_role` to your group attribute's name:

```ini
[auth.saml]
# Use the Group attribute (sent from Okta) for role assignment
assertion_attribute_groups = Group
assertion_attribute_role = Group

# Map Okta group names to Grafana roles
role_values_admin = grafana-admins
role_values_editor = grafana-editors
role_values_viewer = grafana-viewers
```

With this configuration:

- Users in the `grafana-admins` Okta group receive the Admin role
- Users in the `grafana-editors` Okta group receive the Editor role
- Users in the `grafana-viewers` Okta group receive the Viewer role
- Users not matching any group receive the role specified by `auto_assign_org_role` (defaults to Viewer)

{{< admonition type="note" >}}
Group names are case-sensitive. Ensure the group names in Grafana configuration match exactly with the Okta group names.
{{< /admonition >}}

If you're a Grafana Cloud user and want to configure SAML through the UI:

1. Go to **Administration** > **Authentication** > **Configure SAML**.
1. In the **User mapping** section, set:
   - **Groups attribute**: `Group`
   - **Role attribute**: `Group`
1. In the **Role mapping** section, enter your Okta group names for each role.
1. Click **Save**.
