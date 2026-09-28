---
canonical: https://grafana.com/docs/grafana/latest/alerting/guides/provisioning-rate-limits/
description: Avoid and resolve HTTP 429 rate limit errors when you provision Grafana Alerting resources at scale with Terraform, Crossplane, or GitOps tools
keywords:
  - grafana
  - alerting
  - alerting resources
  - provisioning
  - rate limits
  - Terraform
  - Crossplane
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Avoid API rate limits
title: Avoid API rate limits when provisioning alerting resources
weight: 1060
refs:
  alerting_tf_provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/terraform-provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/terraform-provisioning/
  alerting_http_provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/http-api-provisioning/
  service-accounts:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/service-accounts/
---

# Avoid API rate limits when provisioning alerting resources

When you manage Grafana Alerting resources as code, tools such as Terraform, the Crossplane Grafana provider, and GitOps engines repeatedly read your resources to detect drift. At scale, these reconciliation loops can hit an API rate limit, and Grafana rejects the extra requests with the `429 Too Many Requests` status code.

This page explains why provisioning amplifies API requests and how to tune your tooling to stay under the limits.

Before you begin, ensure you have the following:

- A Grafana instance or Grafana Cloud stack where you provision alerting resources.
- Administrative access to the Terraform, Crossplane, or GitOps configuration that manages those resources.
- Access to the logs of the tool that reports the errors.

## Why provisioning at scale triggers rate limits

Rate limits usually depend on how often your tooling reads resources and how many requests each read takes, not on how many resources you manage. The following factors compound each other:

- **Reconciliation loops re-read every resource:** Tools poll Grafana on a fixed interval to compare the live state against the desired state, even when nothing changed. Request volume scales with the number of resources multiplied by the polling frequency.
- **The legacy provisioning API reads alert rules individually:** The API only returns provenance, which marks a resource as provisioned, when you fetch a single rule. To read provenance for a rule group, the Grafana Terraform provider calls `GET /api/v1/provisioning/folder/{folderUID}/rule-groups/{group}`, then calls `GET /api/v1/provisioning/alert-rules/{UID}` once per rule. A group of 50 rules costs 51 requests per reconcile.
- **Multiple tools share one stack:** Running provider pods in several Kubernetes clusters, or Terraform in CI alongside a Crossplane controller, counts every request against the same limits.

## Identify rate limit errors

Rate limited requests fail with the `429 Too Many Requests` status code. Check your tool's logs for that code alongside a provisioning endpoint. For example, the Crossplane Grafana provider reports:

```text
observe failed: failed to observe the resource: [{0 [GET /v1/provisioning/alert-rules/acefead6586dbc] GetAlertRule (status 429): {} []}]
```

In Grafana Cloud, `429` responses include an `x-rate-limit-limit` header with the maximum requests allowed and an `x-rate-limit-duration` header with the window length in seconds. Limits differ by endpoint and deployment, so use these headers to determine your request budget.

## Retry rate limited requests in Terraform

The Grafana Terraform provider retries failed API calls, including `429`, by default. Raise the retry count and wait time to let a plan or apply recover from short bursts of throttling:

```terraform
provider "grafana" {
  url  = "<GRAFANA_URL>"
  auth = "<SERVICE_ACCOUNT_TOKEN>"

  retries            = 10
  retry_wait         = 30
  retry_status_codes = ["429", "5xx"]
}
```

Replace the following values:

- `<GRAFANA_URL>`: The URL of your Grafana instance or Grafana Cloud stack.
- `<SERVICE_ACCOUNT_TOKEN>`: A [service account token](ref:service-accounts) with permissions for the alerting provisioning API.

The retry arguments control the following behavior:

- **`retries`:** The number of times to retry a failed API call.
- **`retry_wait`:** The number of seconds to wait between retries.
- **`retry_status_codes`:** The status codes that trigger a retry, where `x` is a digit wildcard. The default is `429` and any `5xx` code.

You can also set these values with the `GRAFANA_RETRIES`, `GRAFANA_RETRY_WAIT`, and `GRAFANA_RETRY_STATUS_CODES` environment variables.

## Tune the Crossplane provider

Retries don't help a Crossplane controller, because it polls continuously. Lower the request rate instead with the following flags:

- **`--poll`:** How often a resource is checked for drift. The default is `10m`. Increasing it cuts steady-state request volume proportionally.
- **`--max-reconcile-rate`:** The global maximum rate per second at which resources are checked for drift. The default is `100`. Lowering it smooths the burst that occurs when the controller starts and reconciles everything at once.
- **`--sync`:** The controller manager sync period. The default is `1h`.

Set the flags through a `DeploymentRuntimeConfig`, then reference it from the provider:

```yaml
apiVersion: pkg.crossplane.io/v1beta1
kind: DeploymentRuntimeConfig
metadata:
  name: tuned-grafana-provider-config
spec:
  deploymentTemplate:
    spec:
      selector: {}
      template:
        spec:
          containers:
            - name: package-runtime
              args:
                - --poll=30m
                - --max-reconcile-rate=5
---
apiVersion: pkg.crossplane.io/v1
kind: Provider
metadata:
  name: provider-grafana
spec:
  package: <PROVIDER_PACKAGE>
  runtimeConfigRef:
    name: tuned-grafana-provider-config
```

Replace `<PROVIDER_PACKAGE>` with the package reference and version of the provider you run.

The container must be named `package-runtime`, or Crossplane adds it as a sidecar instead of tuning the provider. Use longer intervals in non-production environments and tighten them only where you need faster reconciliation.

## Reduce redundant syncs in GitOps engines

GitOps engines add reconcile cycles on top of the controller's polling. To skip unneeded work, apply only changed resources (`ApplyOutOfSyncOnly=true` in Argo CD), avoid forced re-applies (`Force=true` or `Replace=true`), and align the engine's reconcile interval with the provider's `--poll` value.

## Migrate to the Grafana App Platform alerting APIs

The legacy provisioning endpoints under `/api/v1/provisioning/` are deprecated but still supported, so you can keep using tuned legacy configurations while you plan a migration. The Grafana App Platform alerting APIs expose each alert rule as its own resource under `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/{namespace}/alertrules/{name}`, which avoids the extra per-rule provenance request. In Terraform, the equivalent resource is `grafana_apps_rules_alertrule_v0alpha1`.

If you still hit rate limits after tuning your tools, contact Grafana Support to confirm which limits apply to your stack.

## Next steps

- Refer to [Use Terraform to provision alerting resources](ref:alerting_tf_provisioning) for the full Terraform workflow.
- Refer to [Use the HTTP API to manage alerting resources](ref:alerting_http_provisioning) for the provisioning endpoints and their deprecation status.
- Refer to the [Grafana Terraform provider documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs) for all provider arguments.
- Refer to the [Crossplane pod runtime guide](https://docs.crossplane.io/latest/guides/pods/) for more on `DeploymentRuntimeConfig`.
