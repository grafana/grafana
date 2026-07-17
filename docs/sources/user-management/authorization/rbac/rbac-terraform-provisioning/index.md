---
aliases:
  - ../../../enterprise/access-control/rbac-provisioning/rbac-terraform-provisioning/
  - ../../../administration/roles-and-permissions/access-control/rbac-terraform-provisioning/
description: Learn about RBAC Terraform provisioning and view an example of provisioning
  configuration for Grafana roles and role assignments.
labels:
  products:
    - cloud
    - enterprise
menuTitle: Provisioning RBAC with Terraform
title: Provisioning RBAC with Terraform
weight: 310
refs:
  api-rbac-create-and-manage-custom-roles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/access_control/#create-and-manage-custom-roles
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/developer-resources/api-reference/http-api/access_control/#create-and-manage-custom-roles
  org-http-api-update-user:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/org/#updates-the-given-user
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/developer-resources/api-reference/http-api/org/#updates-the-given-user
  rbac-grafana-provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/user-management/authorization/rbac/rbac-grafana-provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-grafana-provisioning/
  service-accounts:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/user-management/user-identity/service-accounts/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/service-accounts/
  service-accounts-create-a-service-account-in-grafana:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/user-management/user-identity/service-accounts/#create-a-service-account-in-grafana
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/service-accounts/#create-a-service-account-in-grafana
  service-accounts-assign-roles-to-a-service-account-in-grafana:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/user-management/user-identity/service-accounts/#assign-roles-to-a-service-account-in-grafana
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/service-accounts/#assign-roles-to-a-service-account-in-grafana
  service-accounts-to-add-a-token-to-a-service-account:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/user-management/user-identity/service-accounts/#to-add-a-token-to-a-service-account
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/service-accounts/#to-add-a-token-to-a-service-account
  plan-rbac-rollout-strategy:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/user-management/authorization/rbac/plan-rbac-rollout-strategy/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/plan-rbac-rollout-strategy/
  manage-rbac-roles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/user-management/authorization/rbac/manage-rbac-roles/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/manage-rbac-roles/
  custom-role-actions-scopes:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/user-management/authorization/rbac/custom-role-actions-scopes/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/custom-role-actions-scopes/
---

# Provisioning RBAC with Terraform

{{< admonition type="note" >}}
Available in [Grafana Enterprise](/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and [Grafana Cloud](/docs/grafana-cloud).
{{< /admonition >}}

You can create, change or remove [Custom roles](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/role) and create or remove [role assignments](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/role_assignment), by using [Terraform's Grafana provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

Before you provision roles and assignments, decide which roles to create and how to assign them to users and teams. For planning guidance, refer to [Plan your RBAC rollout strategy](ref:plan-rbac-rollout-strategy).

## Before you begin

- Ensure you have the grafana/grafana [Terraform provider](https://registry.terraform.io/providers/grafana/grafana/) 1.29.0 or higher.

- Ensure you are using Grafana 9.2 or higher.

- Decide how to authenticate the provider. We recommend a [service account token](ref:service-accounts) for self-managed Grafana and Grafana Cloud. For more information, refer to [Create a service account token for provisioning](#create-a-service-account-token-for-provisioning).

## Create a service account token for provisioning

We recommend using service account tokens for provisioning. [Service accounts](ref:service-accounts) support fine grained permissions, which allows you to easily authenticate and use the minimum set of permissions needed to provision your RBAC infrastructure.

To create a service account token for provisioning, complete the following steps.

1. [Create a new service account](ref:service-accounts-create-a-service-account-in-grafana) for your CI pipeline.
1. [Assign permissions to service account](ref:service-accounts-assign-roles-to-a-service-account-in-grafana):
   - You will need roles “Role reader”, "Role writer" and roles including any permissions that will be provisioned. For example, to create or assign a role that allows creating users, a service account needs permissions to create users.
   - Alternatively, you can assign "Admin" basic role to the service account.
1. [Create a new service account token](ref:service-accounts-to-add-a-token-to-a-service-account) for use in Terraform.

Alternatively, you can use basic authentication. To view all the supported authentication formats, refer to the [provider authentication documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs#authentication).

## Configure the Terraform provider

RBAC support is included as part of the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

The following example configures the provider. To keep your service account token out of source control, set the credentials with the `GRAFANA_URL` and `GRAFANA_AUTH` environment variables instead of hardcoding them in the configuration:

```terraform
terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = ">= 1.29.0"
    }
  }
}

# Reads credentials from the GRAFANA_URL and GRAFANA_AUTH environment variables
provider "grafana" {}
```

Export the environment variables before you run Terraform:

```bash
export GRAFANA_URL="<GRAFANA_URL>"
export GRAFANA_AUTH="<SERVICE_ACCOUNT_TOKEN>"
```

Replace the following placeholders:

- _`<GRAFANA_URL>`_: The base URL of your Grafana instance, for example `https://<YOUR_STACK_NAME>.grafana.net` on Grafana Cloud or `http://localhost:3000` for a local instance.
- _`<SERVICE_ACCOUNT_TOKEN>`_: A service account token with permission to manage the roles and assignments that you provision, for example `glsa_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.

Alternatively, set the `url` and `auth` attributes directly in the `provider` block. To view all the supported authentication formats, refer to the [provider authentication documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs#authentication).

## Provision basic roles

Basic roles (`None`, `Viewer`, `Editor`, `Admin`, and `Grafana Admin`) correspond to a user's or service account's organization role. A basic role's permissions are derived from the organization role, so you manage basic roles by setting the organization role rather than by creating an RBAC role assignment. The `grafana_role_assignment` resource only assigns fixed and custom roles.

To change which permissions a basic role grants, rather than who has the role, edit the basic role's permissions instead. For more information, refer to [Manage RBAC roles](ref:manage-rbac-roles).

{{< admonition type="note" >}}
Assigning a basic role such as `basic_admin` with `grafana_role_assignment` fails with the error `this endpoint cannot be used to assign basic, managed or external services roles`.
{{< /admonition >}}

### Set the organization role for a service account

Set the `role` attribute on the [`grafana_service_account`](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/service_account) resource:

```terraform
resource "grafana_service_account" "admin_sa" {
  name = "terraform_admin_sa"
  role = "Admin"
}
```

### Set the organization role for users

How you set a user's organization role depends on your Grafana deployment.

**Self-managed Grafana:** use the [`grafana_organization`](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/organization) resource to manage members by organization role. This resource uses Grafana's admin API, so it requires basic authentication and manages organization membership authoritatively.

```terraform
resource "grafana_organization" "org" {
  name    = "my_org"
  admins  = ["admin@example.com"]
  editors = ["editor@example.com"]
  viewers = ["viewer@example.com"]
}
```

**Grafana Cloud:** the `grafana_organization` resource isn't supported, and no Terraform resource currently sets an individual user's organization role. Manage organization roles with the `PATCH /api/org/users/{user_id}` [Organization HTTP API](ref:org-http-api-update-user) endpoint, or through SCIM provisioning or SAML or OIDC role mapping.

### Assign a fixed or custom role to a team

Use fixed or custom roles to grant permissions to teams:

```terraform
resource "grafana_team" "writers_team" {
  name = "terraform_writers_team"
}

# Assign a fixed role to a team
resource "grafana_role_assignment" "writers_team_fixed_role" {
  role_uid = "fixed:dashboards:writer"
  teams    = [grafana_team.writers_team.id]
}
```

## Provision custom roles

The following example shows how to provision a custom role with some permissions.

1. Copy this code block into a .tf file on your local machine.

```terraform
resource "grafana_role" "my_new_role" {
  name        = "custom:users:manager"
  description = "Manage organization users and teams"
  uid         = "customusersmanager"
  version     = 1
  global      = false

  # Manage organization users
  permissions {
    action = "org.users:read"
    scope  = "users:*"
  }
  permissions {
    action = "org.users:add"
    scope  = "users:*"
  }
  permissions {
    action = "org.users:write"
    scope  = "users:*"
  }

  # Manage teams
  permissions {
    action = "teams:create"
  }
  permissions {
    action = "teams:read"
    scope  = "teams:*"
  }
  permissions {
    action = "teams:write"
    scope  = "teams:*"
  }
}
```

For a reference of the available actions and scopes that you can grant in a custom role, refer to [RBAC actions and scopes](ref:custom-role-actions-scopes).

2. Run the command `terraform apply`.
3. Go to Grafana's UI and check that the new role appears in the role picker:
   ![Role Picker](/static/img/docs/enterprise/tf_custom_role.png)

## Provision role assignments

The following example shows how to provision role assignments.
In this example a team, user and service account are provisioned, and the custom role from the previous example is assigned to them.

1. Extend the configuration file from the [previous example](#provision-custom-roles) with the following:

```terraform
resource "grafana_team" "test_team" {
	name = "terraform_test_team"
}

resource "grafana_user" "test_user" {
	email = "terraform_user@test.com"
	login    = "terraform_test_user"
	password = <TEST_PASSWORD>
}

resource "grafana_service_account" "test_sa" {
  name = "terraform_test_sa"
  role = "Viewer"
}

resource "grafana_role_assignment" "my_new_role_assignment" {
  role_uid = grafana_role.my_new_role.uid
  users = [grafana_user.test_user.id]
  teams = [grafana_team.test_team.id]
  service_accounts = [grafana_service_account.test_sa.id]
}
```

1. Substitute `<TEST_PASSWORD>` with a test password for your test user.

1. Run the command `terraform apply`.

1. Go to Grafana's UI and check that a user, team and service account have been created, and that the role has been assigned to them:
   ![User Role Assignment](/static/img/docs/enterprise/tf_user_role_assignment.png)
   ![Team Role Assignment](/static/img/docs/enterprise/tf_team_role_assignment.png)
   ![Service Account Role Assignment](/static/img/docs/enterprise/tf_service_account_role_assignment.png)

Note that instead of using a provisioned role, you can also look up the `uid` of an already existing fixed or custom role and use that instead.
You can use the [API endpoint for listing roles](ref:api-rbac-create-and-manage-custom-roles) to look up role `uid`s.
Similarly, you can look up and use `id`s of users, teams and service accounts that have not been provisioned to assign roles to them.

## Useful links

- [Plan your RBAC rollout strategy](ref:plan-rbac-rollout-strategy)
- [Manage RBAC roles](ref:manage-rbac-roles)
- [RBAC setup with Grafana provisioning](ref:rbac-grafana-provisioning)
- [Grafana Cloud Terraform provisioning](/docs/grafana-cloud/developer-resources/infrastructure-as-code/terraform/)
