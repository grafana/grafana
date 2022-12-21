---
aliases:
  - ../../../enterprise/access-control/rbac-provisioning/rbac-terraform-provisioning/
description: Learn about RBAC Terraform provisioning and view an example of provisioning
  configuration for Grafana roles and role assignments.
menuTitle: Provisioning RBAC with Terraform
title: Provisioning RBAC with Terraform
weight: 60
---

# Provisioning RBAC with Terraform

> **Note:** Available in [Grafana Enterprise]({{< relref "../../../../introduction/grafana-enterprise/" >}}) and [Grafana Cloud Advanced](/docs/grafana-cloud).

You can create, change or remove [Custom roles](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/role) and create or remove [basic and custom role assignments](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/role_assignment), by using [Terraform's Grafana provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

## Before you begin

- Ensure you have the grafana/grafana [Terraform provider](https://registry.terraform.io/providers/grafana/grafana/) 1.29.0 or higher.

- Ensure you are using Grafana 9.2 or higher.

## Create a Service Account Token for provisioning

We recommend using service account tokens for provisioning. [Service accounts]({{< relref "../../../service-accounts/" >}}) support fine grained permissions, which allows you to easily authenticate and use the minimum set of permissions needed to provision your RBAC infrastructure.

To create a service account token for provisioning, complete the following steps.

1. [Create a new service account]({{< relref "../../../service-accounts/#create-a-service-account-in-grafana" >}}) for your CI pipeline.
1. [Assign permissions to service account]({{< relref "../../../service-accounts/#assign-roles-to-a-service-account-in-grafana" >}}):
   - You will need roles “Role reader”, "Role writer" and roles including any permissions that will be provisioned. For example, to create or assign a role that allows creating users, a service account needs permissions to create users.
   - Alternatively, you can assign "Admin" basic role to the service account.
1. [Create a new service account token]({{< relref "../../../service-accounts/#to-add-a-token-to-a-service-account" >}}) for use in Terraform.

Alternatively, you can use basic authentication. To view all the supported authentication formats, see [here](https://registry.terraform.io/providers/grafana/grafana/latest/docs#authentication).

## Configure the Terraform provider

RBAC support is included as part of the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

The following is an example you can use to configure the Terraform provider.

```terraform
terraform {
    required_providers {
        grafana = {
            source = "grafana/grafana"
            version = ">= 1.29.0"
        }
    }
}

provider "grafana" {
    url = <YOUR_GRAFANA_URL>
    auth = <YOUR_GRAFANA_SERVICE_ACCOUNT_TOKEN>
}
```

## Provision custom roles

The following example shows how to provision a custom role with some permissions.

1. Copy this code block into a .tf file on your local machine.

```terraform
resource "grafana_role" "my_new_role" {
  name  = "my_new_role"
  description = "My test role"
  version = 1
  uid = "newroleuid"
  global = true

  permissions {
    action = "org.users:add"
    scope = "users:*"
  }
  permissions {
    action = "org.users:write"
    scope = "users:*"
  }
  permissions {
    action = "org.users:read"
    scope = "users:*"
  }
  permissions {
	  action = "teams:create"
  }
  permissions {
	  action = "teams:read"
	  scope = "teams:*"
  }
  permissions {
	  action = "teams:write"
	  scope = "teams:*"
  }
}
```

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
You can use the [API endpoint for listing roles](https://grafana.com/docs/grafana/latest/developers/http_api/access_control/#create-and-manage-custom-roles) to look up role `uid`s.
Similarly, you can look up and use `id`s of users, teams and service accounts that have not been provisioned to assign roles to them.

## Useful Links

[RBAC setup with Grafana provisioning]({{< relref "./rbac-grafana-provisioning">}})

[Grafana Cloud Terraform provisioning](/docs/grafana-cloud/infrastructure-as-code/terraform/)
