# Datasource file provisioning validation

The `datasources.rejectProvisionedLBACRules` feature flag controls rejection of embedded LBAC policy in datasource provisioning files. It defaults to true to enforce the documented restriction on file-provisioned LBAC rules. Setting it to false restores the previous provisioning behavior.

> **Note:** The public [LBAC rule creation documentation](https://grafana.com/docs/grafana/latest/administration/data-source-management/teamlbac/create-teamlbac-rules/#:~:text=You%20can%E2%80%99t%20add%20LBAC%20rules%20to%20a%20file%2Dprovisioned%20data%20source) states: "You can’t add LBAC rules to a file-provisioned data source." This guard rejects embedded LBAC rules in datasource provisioning files in accordance with that documented restriction.

Both YAML configuration versions use the same provisioning path. The deprecated version 0 format uses `json_data`; version 1 uses `jsonData`. Each file can contain multiple datasources, and validation checks every datasource in the file.

When enabled, validation rejects `X-Prom-Label-Policy` entries in `jsonData.teamHttpHeaders` (or version 0 `json_data.teamHttpHeaders`). Header-name matching is case-insensitive. Rejection does not depend on selector validity, team existence, datasource type, or whether the datasource already exists. Structurally invalid `teamHttpHeaders` values also produce a configuration error. Errors identify the file, datasource, and field without including policy values.

Validation allows an absent field, null, empty objects, empty headers, empty team rule lists, and structurally valid custom-only team headers. Allowed values retain their existing representation. In particular, empty markers can affect Cloud routing and are not stripped.

Each startup or admin reload evaluates the flag again. All datasource files are validated before that pass creates, updates, deletes, or prunes datasources. A validation error aborts datasource provisioning; at startup it propagates as a startup failure, while admin reload returns an error to the caller.

The guard inspects file contents, not existing stored policy. Removing policy from a file does not remove stored rules: the existing datasource service continues to retain them during ordinary updates. Existing-rule migration and cleanup are separate operations.

The validation is confined to file provisioning. It does not change datasource HTTP or Kubernetes API behavior, Terraform rule management, TeamLBACRule authorization or storage, or query enforcement. If flag evaluation is unavailable, validation remains enabled. Explicitly disabling the flag restores the previous behavior.

File-provisioned LBAC policy is outside the documented supported workflow. Use the [documented Terraform workflow](https://grafana.com/docs/grafana/latest/administration/data-source-management/teamlbac/#provision-lbac-rules) to provision an LBAC-enabled datasource and its rules.
