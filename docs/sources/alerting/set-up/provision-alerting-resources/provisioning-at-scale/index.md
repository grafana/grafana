---
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/provisioning-at-scale/
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
weight: 500
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

When you manage Grafana Alerting resources as code, controllers such as Terraform, the Crossplane Grafana provider, and GitOps engines repeatedly read your resources to detect drift. At scale, these reconciliation loops can send enough requests to hit an API rate limit, and Grafana rejects the extra requests with the `429 Too Many Requests` status code.

This page explains why provisioning at scale amplifies API requests, how to recognize rate limit errors, and how to tune your tooling to stay under the limits.

Before you begin, ensure you have the following:

- A Grafana instance or Grafana Cloud stack where you provision alerting resources.
- Administrative access to the Terraform configuration, Crossplane provider, or GitOps engine that manages those resources.
- Access to the logs of the controller that reports the errors.

## Why provisioning at scale triggers rate limits

Rate limits usually aren't caused by the number of alerting resources you manage. They're caused by how often your tooling reads those resources, and by how many API requests each read takes.

The following factors compound each other:

- **Reconciliation loops re-read every resource:** Controllers poll Grafana on a fixed interval to compare the live state against the desired state. The request volume scales with the number of resources multiplied by the polling frequency, whether or not anything changed.
- **The legacy provisioning API reads alert rules individually:** Provenance, which marks a resource as provisioned, is only returned when you fetch a single rule. To determine provenance for a rule group, the Grafana Terraform provider first calls `GET /api/v1/provisioning/folder/{folderUID}/rule-groups/{group}`, then calls `GET /api/v1/provisioning/alert-rules/{UID}` once per rule in that group. A single rule group with 50 rules costs 51 requests per reconcile.
- **Multiple controllers share one stack:** Running provider pods in several Kubernetes clusters, or running Terraform in CI alongside a Crossplane controller, means every controller's requests count against the same limits.

## Identify rate limit errors

Rate limited requests fail with the `429 Too Many Requests` status code. Check your controller logs for that status code alongside a provisioning endpoint.

The Crossplane Grafana provider reports the failure when it tries to observe a resource:

```text
observe failed: failed to observe the resource: [{0 [GET /v1/provisioning/alert-rules/acefead6586dbc] GetAlertRule (status 429): {} []}]
```

In Grafana Cloud, `429` responses include headers that describe the limit that was applied:

- **`x-rate-limit-limit`:** The maximum number of requests allowed within the window.
- **`x-rate-limit-duration`:** The length of the window in seconds.

Limits differ by endpoint and deployment, so treat these headers as the source of truth for the request budget you have to work with.

## Retry rate limited requests in Terraform

The Grafana Terraform provider retries failed API calls, and retries on `429` by default. Raising the retry count and wait time helps a plan or apply ride out short bursts of throttling instead of failing.

Configure the retry behavior in the provider block:

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

Retries alone don't help a Crossplane controller, because it polls continuously. Lower the request rate instead by increasing the poll interval and reducing the reconcile rate.

The Crossplane Grafana provider accepts the following flags:

- **`--poll`:** Controls how often an individual resource is checked for drift. The default is `10m`. Increasing it to `30m` or more cuts the steady-state request volume proportionally.
- **`--max-reconcile-rate`:** Sets the global maximum rate per second at which resources are checked for drift. The default is `100`. Lowering it to a single-digit value smooths bursts, which matters most right after the controller starts and reconciles everything at once.
- **`--sync`:** Sets the controller manager sync period. The default is `1h`.

Set the flags through a `DeploymentRuntimeConfig`:

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
```

The container must be named `package-runtime`. Crossplane adds any other container as a sidecar instead of applying the arguments to the provider.

Reference the runtime config from the provider so the settings apply:

```yaml
apiVersion: pkg.crossplane.io/v1
kind: Provider
metadata:
  name: provider-grafana
spec:
  package: <PROVIDER_PACKAGE>
  runtimeConfigRef:
    name: tuned-grafana-provider-config
```

Replace `<PROVIDER_PACKAGE>` with the package reference and version of the Crossplane Grafana provider you run.

Start from longer intervals in non-production environments, where drift detection is less urgent, and tighten them only where you need faster reconciliation.

## Reduce redundant syncs in GitOps engines

GitOps engines add their own reconcile cycles on top of the controller's polling. Configure them to skip work that isn't needed:

- **Apply only changed resources:** In Argo CD, enable the `ApplyOutOfSyncOnly=true` sync option so unchanged resources aren't re-applied.
- **Avoid forced re-applies:** Options such as `Force=true` and `Replace=true` recreate resources that haven't changed, which triggers extra observe cycles against Grafana.
- **Lengthen the sync interval:** Align the engine's reconcile interval with the provider's `--poll` value so the two don't overlap unnecessarily.

## Separate credentials per environment

Some rate limits apply per credential. If you run controllers in several clusters, create a dedicated [service account](ref:service-accounts) and token for each one, rather than sharing a single token.

Separate credentials give each cluster its own request budget where per-credential limits apply, and they make it far easier to tell which controller is generating the traffic.

## Migrate to the Grafana App Platform alerting APIs

The legacy provisioning endpoints under `/api/v1/provisioning/` are deprecated. They remain available and supported, and Grafana gives advance notice before removing them, so you can keep using tuned legacy configurations while you plan a migration.

The Grafana App Platform alerting APIs expose each alert rule as its own resource under `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/{namespace}/alertrules/{name}`, which avoids the extra per-rule request needed to read provenance from the legacy API. In Terraform, the equivalent resource is `grafana_apps_rules_alertrule_v0alpha1`.

If you still hit rate limits after tuning your controllers, contact Grafana Support to confirm which limits apply to your stack.

## Next steps

- Refer to [Use Terraform to provision alerting resources](ref:alerting_tf_provisioning) for the full Terraform workflow.
- Refer to [Use the HTTP API to manage alerting resources](ref:alerting_http_provisioning) for the provisioning endpoints and their deprecation status.
- Refer to the [Grafana Terraform provider documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs) for all provider arguments.
- Refer to the [Crossplane pod runtime guide](https://docs.crossplane.io/latest/guides/pods/) for more on `DeploymentRuntimeConfig`.
