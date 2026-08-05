---
description: Learn how to manage saved queries using the Grafana Terraform provider
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Terraform
  - Saved queries
  - Query library
labels:
  products:
    - cloud
    - enterprise
title: Manage saved queries using Terraform
menuTitle: Manage saved queries
weight: 400
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/manage-saved-queries/
---

# Manage saved queries using Terraform

This guide shows you how to manage [saved queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/#saved-queries), also known as the query library, using the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs). Managing saved queries as code lets you version-control your query library and keep it consistent across Grafana instances.

{{< admonition type="note" >}}
Saved queries are only available on Grafana Enterprise and Grafana Cloud.
{{< /admonition >}}

## Before you begin

Before you begin, ensure you have the following:

- A Grafana Enterprise or Grafana Cloud instance. For more information on setting up a Grafana Cloud account, refer to [Get started](https://grafana.com/docs/grafana-cloud/get-started/).
- Terraform installed on your machine. For more information on how to install Terraform, refer to the [Terraform install documentation](https://developer.hashicorp.com/terraform/install).
- A service account token with the **Writer** role for saved queries. For more information, refer to [Roles, permissions, and RBAC](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/#roles-permissions-and-rbac) and [Service account tokens](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/#service-account-tokens).

## Configure the Grafana provider

Create a file named `main.tf` and add the following to set up the [Grafana provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs) with the authentication required to manage saved queries:

```terraform
terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = ">= 4.6.0"
    }
  }
}

provider "grafana" {
  url  = "<Grafana-URL>"
  auth = "<Service-account-token>"
}
```

Replace the following field values:

- `Grafana-URL` with the URL of your Grafana instance, for example `https://my-stack.grafana.net/`
- `Service-account-token` with the service account token that you created

## Create a saved query resource

Create a file named `saved-queries.tf` and add the following:

```terraform
resource "grafana_apps_queries_query_v1" "example" {
  metadata {
    uid = "example-saved-query"
  }

  spec {
    title       = "Requests per second"
    description = "Prometheus rate of HTTP requests"
    is_visible  = true
    tags        = ["http", "prometheus"]

    targets {
      properties_json = jsonencode({
        refId = "A"
        expr  = "rate(http_requests_total[$__rate_interval])"
        datasource = {
          type = "prometheus"
          uid  = "my-prometheus-uid"
        }
      })
    }
  }
}
```

Because the shape of a data source query depends on the data source, the query stored in each target (`properties_json`), a target's variable replacements (`variables_json`), and a variable's value list (`value_list_definition_json`) are passed as raw JSON strings. Use `jsonencode()` to construct them.

The `spec` block supports the following fields:

| Field         | Description                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| `title`       | The display name of the saved query. Required.                                                                  |
| `description` | A longer description of the saved query.                                                                        |
| `is_visible`  | Whether the saved query is visible in the query library.                                                        |
| `is_locked`   | Whether the saved query is locked and can't be edited in the UI. This is for UI display only, not for security. |
| `tags`        | The tags used to filter the saved query.                                                                        |
| `targets`     | The query targets that make up the saved query. At least one target is required.                                |
| `vars`        | The template variables that can be interpolated into the query targets.                                         |

For the complete schema, refer to the [`grafana_apps_queries_query_v1` resource documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/apps_queries_query_v1).

## Import an existing saved query

To bring an existing saved query under Terraform management, import it using its UID:

```shell
terraform import grafana_apps_queries_query_v1.example example-saved-query
```

## Summary

In this guide, you learned how to create and import saved queries using Terraform.

To learn more about saved queries, refer to [Saved queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/#saved-queries).
