---
description: Use the Grafana Terraform provider to create, rotate, and manage secure values in Grafana Secrets Management as version-controlled, declarative infrastructure alongside the rest of your Grafana stack.
keywords:
  - Infrastructure as Code
  - Grafana Cloud
  - Terraform
  - Secrets Management
  - Secure values
labels:
  products:
    - cloud
  stage: public-preview
menuTitle: Provision with Terraform
title: Use Terraform to provision secure values
weight: 130
review_date: '2026-07-03'
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/terraform-secrets-management/
---

# Use Terraform to provision secure values

Use the Terraform Grafana provider to create and manage secure values in [Grafana Secrets Management](https://grafana.com/docs/grafana-cloud/security-and-account-management/manage-secrets/) as code.
With Terraform, you keep secrets such as API keys, tokens, passwords, and certificates in version-controlled, declarative infrastructure alongside the rest of your Grafana stack.

This guide covers _secure values_, which you manage with the [`grafana_apps_secret_securevalue_v1beta1`](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/apps_secret_securevalue_v1beta1) resource.
By default, Grafana stores secure values in the built-in _system keeper_, which requires no setup.
If you configure an additional keeper and set it as the active keeper for your namespace, Grafana stores new secure values there automatically.
For more information, refer to [Activate and use the keeper](#activate-and-use-the-keeper).
To store secure values in an external secret manager instead, [provision a keeper](#provision-a-keeper).

To create and manage secure values with Terraform, you complete the following tasks:

1. Create a service account token to authenticate the Terraform provider.
1. Configure the Grafana provider.
1. Define one or more secure values.
1. Run `terraform apply` to provision your secure values.

## Before you begin

To provision secure values with Terraform, you need the following:

- A Grafana Cloud instance that you can reach from the machine that runs Terraform.
- Permission to create service account tokens.

You also need the following tools at the minimum supported versions:

| Tool                                 | Minimum version                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Terraform CLI                        | 1.11, for [write-only arguments](https://developer.hashicorp.com/terraform/language/resources/ephemeral#write-only-arguments) |
| `grafana/grafana` Terraform provider | 4.26.0                                                                                                                        |

If you don't have the Terraform CLI, refer to the [Terraform install documentation](https://developer.hashicorp.com/terraform/install).
The `grafana/grafana` provider downloads automatically when you run `terraform init` in [Provision the secure value with Terraform](#provision-the-secure-value-with-terraform).

{{< admonition type="note" >}}
All of the following Terraform configuration files should be saved in the same directory.
{{< /admonition >}}

## Create a service account token

Terraform authenticates against Grafana with a service account token.

To create a service account and token, follow these steps:

1. Create a service account and token in Grafana.
   To create them, refer to [Service account tokens](https://grafana.com/docs/grafana/latest/administration/service-accounts/#service-account-tokens).
   You can also refer to [Create and manage a Grafana Cloud stack using Terraform](../terraform-cloud-stack/) to set up a service account and token.

1. Make sure the service account has the role-based access control (RBAC) actions needed to manage secure values:
   - `secret.securevalues:create`
   - `secret.securevalues:read`
   - `secret.securevalues:write`
   - `secret.securevalues:delete`

   If you also provision a keeper (refer to [Provision a keeper](#provision-a-keeper)), the service account also needs the keeper actions, which cover activating a keeper:
   - `secret.keepers:create`
   - `secret.keepers:read`
   - `secret.keepers:write`
   - `secret.keepers:delete`

1. Copy the token and store it securely, because you can't view it again after you leave the page.

## Configure the Grafana provider

In your Terraform working directory, create a `main.tf` file:

```terraform
terraform {
  required_version = ">= 1.11.0"

  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = ">= 4.26.0"
    }
  }
}

variable "grafana_auth" {
  type      = string
  sensitive = true
}

provider "grafana" {
  url  = "<GRAFANA_URL>"
  auth = var.grafana_auth

  # Required for app-platform resources, including secure values.
  stack_id = <STACK_ID>
}
```

Replace the placeholders as follows:

- _`<GRAFANA_URL>`_ is the URL of your Grafana instance, for example `https://my-org.grafana.net`.
- _`<STACK_ID>`_ is your numeric Grafana Cloud stack ID, for example `123456`.

  To find your stack ID, open the [Grafana Cloud Portal](https://grafana.com/profile/org), select your stack, and read the numeric **Instance ID**. That value is your `stack_id`.

  You can also retrieve it with a `GET` request to `https://grafana.com/api/orgs/<ORG_SLUG>/instances`, where _`<ORG_SLUG>`_ is your Grafana Cloud organization name.
  The numeric `id` field in the response is the stack ID.
  This Cloud API endpoint authenticates with a [Cloud Access Policy token](https://grafana.com/docs/grafana-cloud/developer-resources/api-reference/cloud-api/), which is separate from the service account token that Terraform uses.

Provide each input variable through a matching environment variable that follows the Terraform `TF_VAR_<variable_name>` naming convention.
The part after `TF_VAR_` is the name of the variable in your configuration: Terraform maps `TF_VAR_grafana_auth` to the `grafana_auth` variable, `TF_VAR_external_api_key` to `external_api_key`, and so on.
You can also use a secrets manager or a `terraform.tfvars` file.
Don't set variables in a file that you commit.

For other authentication options, refer to the [Grafana provider documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs#authentication).
For end-to-end stack management, refer to [Create and manage a Grafana Cloud stack using Terraform](../terraform-cloud-stack/).

## Define a secure value

The following example stores an API key as a secure value and authorizes Synthetic Monitoring to decrypt it.
Add it to `main.tf`, or to any other `.tf` file in the same working directory.
Terraform loads all `.tf` files in the directory together.

```terraform
variable "external_api_key" {
  type      = string
  sensitive = true
  ephemeral = true # Keeps the value out of state and plan files.
}

resource "grafana_apps_secret_securevalue_v1beta1" "external_api_key" {
  metadata {
    uid = "external-api-key" # The secure value's name.
  }

  spec {
    description = "External API key"
    value       = var.external_api_key
    decrypters  = ["synthetic-monitoring"]
  }
}
```

Keep the following points in mind for this example:

- `metadata.uid` is the secure value's _name_ in Grafana.
  The resource also exposes a separate, read-only `metadata.uuid`, which is the Grafana-generated identifier rather than the name.
- `spec.description` is required and limited to 25 characters.
  Longer values fail on apply with an `Invalid Attribute Value Length` error.
- `spec.value` is a [write-only argument](https://developer.hashicorp.com/terraform/language/resources/ephemeral#write-only-arguments) that requires Terraform 1.11 or later.
  Terraform sends the plaintext to Grafana on apply, but never writes it to state, plan output, or any other on-disk artifact.
  Combine it with an `ephemeral`, sensitive variable, as in the preceding example, so the value also stays out of `terraform plan` output.
- You don't pass a `namespace`. The provider derives it from `stack_id`.
- You don't pass a keeper name. Grafana stores the value in whichever keeper is the active keeper for your namespace, which is the system keeper by default.

### Schema reference

The full schema is on the [Terraform Registry](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/apps_secret_securevalue_v1beta1).
The following tables describe the fields you use for secure values.

The `metadata` block contains the following fields:

| Field                                   | Required | Description                                                                   |
| --------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| `uid`                                   | Yes      | The secure value's name. Up to 253 characters, DNS-compatible, and immutable. |
| `folder_uid`                            | No       | Not used for secure values. Leave it unset.                                   |
| `uuid`, `version`, `url`, `annotations` | No       | Read-only. Grafana populates these fields.                                    |

The `spec` block contains the following fields:

| Field         | Required                  | Description                                                                                                                                                                                                                                                                                            |
| ------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `description` | Yes, enforced server-side | 1 to 25 characters.                                                                                                                                                                                                                                                                                    |
| `value`       | Conditional               | Plaintext secret value, 1 to 24,576 bytes. Sensitive and [write-only](https://developer.hashicorp.com/terraform/language/resources/ephemeral#write-only-arguments) in Terraform 1.11 or later. Sent to Grafana on apply but never written to state or plan files. Set exactly one of `value` or `ref`. |
| `ref`         | Conditional               | Reference to a secret already stored in a third-party keeper, 1 to 1,024 characters. Valid only when the namespace's active keeper isn't the system keeper. Set exactly one of `value` or `ref`.                                                                                                       |
| `decrypters`  | No                        | List of services permitted to decrypt this secure value. Up to 64 unique entries. Each entry must be a valid Kubernetes label value: alphanumerics plus `.`, `-`, and `_`, with no slashes or spaces. For more information, refer to [Decrypters](#decrypters).                                        |
| `value_hash`  | Computed                  | Read-only SHA-256 hash of the stored value. The provider uses it to detect rotation. Don't set it yourself.                                                                                                                                                                                            |

The `options` block is optional and contains the following fields:

| Field              | Required | Description                                                                                                                                                                                    |
| ------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manager_identity` | No       | Overrides the manager identity stamped on this resource. The default is `grafana-terraform-provider`. Useful when multiple Terraform workspaces manage resources in the same Grafana instance. |
| `overwrite`        | No       | Set to `true` to overwrite an existing resource with the same UID when applicable.                                                                                                             |

At the top level, the resource exposes a read-only `id` field, which Grafana derives from the secure value's UUID.

### Decrypters

The `decrypters` list controls which Grafana services can decrypt a secret. If a service isn't in the list, it can't read the plaintext value, even if it has access to the secure value's metadata. An empty or unset list means no service can decrypt the value.

Grafana supports the following decrypters:

| Decrypter              | Consumer                    |
| ---------------------- | --------------------------- |
| `k6-cloud`             | Grafana Cloud k6            |
| `synthetic-monitoring` | Synthetic Monitoring checks |

Grant the minimum set of decrypters required for your use case.

## Provision the secure value with Terraform

To apply the configuration, follow these steps:

1. Initialize the working directory.
   This downloads the Grafana provider.

   ```shell
   terraform init
   ```

1. Set the environment variables, then preview and apply the changes:

   ```shell
   export TF_VAR_grafana_auth='<TOKEN>'
   export TF_VAR_external_api_key='<SECRET>'
   terraform plan
   terraform apply
   ```

   Replace the placeholders as follows:
   - _`<TOKEN>`_ is the service account token you created in [Create a service account token](#create-a-service-account-token).
   - _`<SECRET>`_ is the plaintext secret value that Terraform stores as the secure value.

   This keeps secrets out of Terraform files.
   If your shell writes history, prefer a secure secret-injection flow, such as CI/CD secrets, a secret manager, or a subshell with history disabled.

   Terraform shows the execution plan and asks for confirmation:

   ```console
   Plan: 1 to add, 0 to change, 0 to destroy.

   Do you want to perform these actions?
     Terraform will perform the actions described above.
     Only 'yes' will be accepted to approve.

     Enter a value:
   ```

   After you confirm, Terraform creates the secure value:

   ```console
   Apply complete! Resources: 1 added, 0 changed, 0 destroyed.
   ```

If a secure value with the same `metadata.uid` already exists in the namespace, for example from a previous apply or one created outside Terraform, the apply fails with `HTTP 409 - AlreadyExists`.
To bring the existing secure value under Terraform management instead of recreating it, [import it](#import-an-existing-secure-value).
To replace it on apply, set `overwrite = true` in the resource's `options` block.

### Verify that the plaintext stays out of state

Because `spec.value` is write-only, Terraform never writes the plaintext to state.
It writes only the `value_hash`.
To confirm this, search your local state file for the plaintext:

```shell
grep -c '<SECRET_VALUE>' terraform.tfstate
```

Replace _`<SECRET_VALUE>`_ with the plaintext secret you provisioned.
The search returns no matches:

```console
0
```

The stored `spec` shows `value` as `null` and retains only the hash:

```json
"spec": {
  "decrypters": ["synthetic-monitoring"],
  "description": "External API key",
  "ref": null,
  "value": null,
  "value_hash": "65f087ba121c13dec3fa0cb7697d4309ed5e624ba528a758bb9071bee220825a"
}
```

To verify the result, open **Administration** > **Secrets** in Grafana, or call the [Secrets Management HTTP API](https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/secrets_management/) directly.
The namespace is `stacks-<STACK_ID>`:

```shell
curl -H "Authorization: Bearer <TOKEN>" \
  "<GRAFANA_URL>/apis/secret.grafana.app/v1beta1/namespaces/stacks-<STACK_ID>/securevalues/external-api-key"
```

The response includes the secure value's metadata, its `spec` with `description` and `decrypters`, and the keeper that stores it.
It never includes the plaintext `value`:

```json
{
  "kind": "SecureValue",
  "apiVersion": "secret.grafana.app/v1beta1",
  "metadata": {
    "name": "external-api-key",
    "namespace": "stacks-<STACK_ID>",
    "annotations": {
      "grafana.app/managedBy": "terraform",
      "grafana.app/managerId": "grafana-terraform-provider"
    }
  },
  "spec": {
    "description": "External API key",
    "decrypters": ["synthetic-monitoring"]
  },
  "status": {
    "version": 1,
    "keeper": "system"
  }
}
```

There is no `value` field in the response. The API doesn't return decrypted secret contents.

## Rotate a secure value

To rotate a secret, change the value, or the variable that feeds it, and run `terraform apply` again.

The provider computes a SHA-256 hash of your configured `spec.value` at plan time and stores it in `value_hash`. When the hash changes, Terraform plans an update. When the hash doesn't change, Terraform plans no change. This lets you rotate secrets without storing plaintext in state.

```terraform
resource "grafana_apps_secret_securevalue_v1beta1" "external_api_key" {
  metadata {
    uid = "external-api-key"
  }

  spec {
    description = "External API key"
    value       = var.external_api_key # Supply the new value here.
    decrypters  = ["synthetic-monitoring"]
  }
}
```

When the value changes, the recomputed `value_hash` drives an in-place update:

```console
  ~ spec {
      ~ value_hash = (sensitive value)
    }

Plan: 0 to add, 1 to change, 0 to destroy.
```

If you apply again without changing the value, the hash matches and Terraform plans no change:

```console
No changes. Your infrastructure matches the configuration.
```

### Rotation considerations

Keep the following points in mind when you rotate secure values:

- **`value` is write-only.**
  The Grafana API never returns the plaintext, and the provider never reads it back.
  Only `value_hash` is stored in state.
- **Out-of-band value changes aren't directly detectable.**
  Because the plaintext is write-only, Terraform can't read the current secret contents from Grafana.
  Keep Terraform as your source of truth for rotations.
- **You can't switch a secure value between `value` and `ref` after creation.**
  The API rejects updates that try to change mode.
  To change mode, destroy and recreate the resource.
- **`metadata.uid` is immutable.**
  Changing it forces Terraform to destroy and recreate the secure value.
- **`decrypters` ordering is significant in Terraform.**
  Keep a stable order in your configuration to avoid noisy plans.
- **An update is a full replace with `PUT`, not a patch.**
  Always provide `description` and `decrypters` together with `value` or `ref` on update.
  If you omit them, the new spec replaces the old one in full.

### Handle the secret value safely

{{< admonition type="warning" >}}
Never check plaintext secret values into Terraform configuration.
{{< /admonition >}}

Instead, use one of the following approaches:

- A `sensitive` or `ephemeral` Terraform variable populated from a `TF_VAR_*` environment variable.
- A CI/CD secret injected at apply time.
- A dedicated secret store, such as HashiCorp Vault or AWS Secrets Manager, referenced from Terraform with the appropriate provider data source.

## Import an existing secure value

The `grafana_apps_secret_securevalue_v1beta1` resource supports import.
The import ID is the secure value name, which is the value of `metadata.uid`:

```shell
terraform import grafana_apps_secret_securevalue_v1beta1.external_api_key external-api-key
```

After you import a secure value, keep the following points in mind:

- `spec.value` is still write-only, and Terraform never imports it into state.
- For value-backed secure values, set `spec.value` in configuration before you apply.
  The first managed apply sets or rotates the value to whatever you configure.
- For reference-backed secure values, set `spec.ref` in configuration to match the existing reference.
- Because you must set exactly one of `value` or `ref`, your configuration must include one of them after import.

## Provision a keeper

A _keeper_ defines where Grafana stores the encrypted material for your secure values. By default, Grafana uses the built-in system keeper, which encrypts values at rest in the Grafana database and requires no setup.

To store secrets in an external secret manager instead, provision a keeper with the [`grafana_apps_secret_keeper_v1beta1`](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/apps_secret_keeper_v1beta1) resource.
Grafana currently supports AWS Secrets Manager as a keeper.

Grafana connects to AWS Secrets Manager through cross-account role assumption with AWS Security Token Service, and never stores your AWS credentials.
You create an AWS Identity and Access Management (IAM) role in your AWS account that Grafana can assume, and the keeper references that role.

### Keeper requirements

In addition to the [requirements for secure values](#before-you-begin), you need the following:

- An AWS account with AWS Secrets Manager enabled in your target region.
- An IAM role that Grafana can assume, along with its role ARN and external ID.
  For the IAM role and trust policy that the role requires, refer to [Manage keepers](https://grafana.com/docs/grafana-cloud/security-and-account-management/manage-keepers/).

### Define a keeper

The following example provisions an AWS Secrets Manager keeper. Add it to `main.tf`, or to any other `.tf` file in the same working directory.

```terraform
resource "grafana_apps_secret_keeper_v1beta1" "aws_secrets_manager" {
  metadata {
    uid = "aws-secrets-manager" # The keeper's name.
  }

  spec {
    description = "AWS Secrets Manager keeper"

    aws {
      region = "<REGION>"

      assume_role {
        assume_role_arn = "arn:aws:iam::<ACCOUNT_ID>:role/grafana-secrets-manager"
        external_id     = "<EXTERNAL_ID>"
      }
    }
  }
}
```

Replace the placeholders as follows:

- _`<REGION>`_ is the AWS region that hosts your secrets, for example `us-east-1`.
- _`<ACCOUNT_ID>`_ is the ID of the AWS account that hosts your secrets.
- _`<EXTERNAL_ID>`_ is the external ID that your IAM role's trust policy requires.

Apply the keeper with the same `terraform apply` workflow you use for a secure value, described in [Provision the secure value with Terraform](#provision-the-secure-value-with-terraform).
Unlike a secure value, a keeper has no secret value, so it needs no `ephemeral` variable of its own: `TF_VAR_grafana_auth` for the provider is the only variable you export.
If the keeper shares a working directory with secure values, a single apply creates the keeper and those secure values together.

### Keeper schema reference

The full schema is on the [Terraform Registry](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/apps_secret_keeper_v1beta1). The following tables describe the fields you use for a keeper.

The `metadata` block contains the following fields:

| Field | Required | Description                                                             |
| ----- | -------- | ----------------------------------------------------------------------- |
| `uid` | Yes      | The keeper's name. Up to 253 characters, DNS-compatible, and immutable. |

The `spec` block contains the following fields:

| Field         | Required | Description                                                                            |
| ------------- | -------- | -------------------------------------------------------------------------------------- |
| `description` | Yes      | Short description for the keeper, 1 to 253 characters.                                 |
| `aws`         | No       | AWS Secrets Manager configuration. For the fields, refer to the following `aws` table. |

The `aws` block contains the following fields:

| Field         | Required | Description                                                                                                               |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `region`      | Yes      | AWS region that hosts your secrets, for example `us-east-1`.                                                              |
| `assume_role` | No       | Role that Grafana assumes to access AWS Secrets Manager. When set, `assume_role_arn` and `external_id` are both required. |

The `assume_role` block contains the following fields:

| Field             | Required | Description                                            |
| ----------------- | -------- | ------------------------------------------------------ |
| `assume_role_arn` | Yes      | ARN of the IAM role that Grafana assumes.              |
| `external_id`     | Yes      | External ID that the IAM role's trust policy requires. |

At the top level, the resource exposes a read-only `active` status that's `true` when the keeper is the active keeper for the namespace.

### Activate and use the keeper

Creating a keeper with Terraform doesn't make it active. Each namespace has at most one active keeper, which determines where Grafana stores new secure values.

To set a keeper as active, use the [`grafana_apps_secret_keeper_activation_v1beta1`](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/apps_secret_keeper_activation_v1beta1) resource and reference the keeper's `uid`:

```terraform
resource "grafana_apps_secret_keeper_activation_v1beta1" "aws_secrets_manager" {
  metadata {
    uid = grafana_apps_secret_keeper_v1beta1.aws_secrets_manager.metadata.uid
  }
}
```

Keep the following points in mind for this resource:

- Because a namespace has only one active keeper, applying an activation for a different keeper switches which keeper is active.
- Running `terraform destroy` on the activation resource reverts the namespace to the built-in system keeper.

You can also set the active keeper outside Terraform, in the Grafana UI under **Administration** > **Secrets**.

After the keeper is active, Grafana routes new secure values to it automatically.
A `value`-backed secure value like the one in [Define a secure value](#define-a-secure-value) needs no changes to use the active keeper.

To reference a secret that already exists in the third-party keeper instead of sending a new value, use `ref` in place of `value`:

```terraform
resource "grafana_apps_secret_securevalue_v1beta1" "db_password" {
  metadata {
    uid = "db-password"
  }

  spec {
    description = "Production DB password"
    ref         = "prod/db/password" # Path inside the active keeper.
    decrypters  = ["synthetic-monitoring"]
  }
}
```

If you use `ref` while the system keeper is active, the API returns the following error:

```console
tried to create secure value using reference with system keeper, references can only be used with 3rd party keepers
```

## Summary

In this guide, you created a service account token, configured the Grafana provider, and provisioned a secure value with Terraform.
You also learned how to rotate and import secure values, and how to provision and activate a keeper to store secrets in an external secret manager.

To learn more about managing Grafana Cloud using Terraform, refer to the [Grafana provider documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

## Next steps

- For the full secure value schema and more examples, refer to [`grafana_apps_secret_securevalue_v1beta1` on the Terraform Registry](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/apps_secret_securevalue_v1beta1).
- For the full keeper schema, refer to [`grafana_apps_secret_keeper_v1beta1` on the Terraform Registry](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/apps_secret_keeper_v1beta1).
- For the keeper activation resource, refer to [`grafana_apps_secret_keeper_activation_v1beta1` on the Terraform Registry](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/apps_secret_keeper_activation_v1beta1).
- For concepts, permissions, and limits, refer to [Manage secrets](https://grafana.com/docs/grafana-cloud/security-and-account-management/manage-secrets/).
- For the underlying HTTP API, refer to the [Secrets Management API](https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/secrets_management/).
- For more about write-only arguments, refer to [Ephemeral values](https://developer.hashicorp.com/terraform/language/resources/ephemeral#write-only-arguments) in the Terraform documentation.
