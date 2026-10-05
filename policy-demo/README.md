# Validation policy demo

This demo shows how Grafana apps can enforce their own configuration on app platform resources
with CEL validation policies, and how a `Deny` policy stops a non-compliant resource from being
created at all.

Two demo apps take part. Neither asks admins to write CEL: each offers a small resource in its
own terms, and its reconciler turns that resource into a validation policy.

| App                               | Resource             | What it controls                                                 |
| --------------------------------- | -------------------- | ---------------------------------------------------------------- |
| `rulepolicy.alerting.grafana.app` | `RulePolicy`         | Labels and annotations every alert rule must, or must not, carry |
| `foldernaming.grafana.app`        | `FolderNamingPolicy` | A naming convention for folder titles                            |

Both write to the platform API, `policy.grafana.app`, which the API server evaluates on every
write to an app platform resource.

## How it works

```
 admin writes            app reconciler writes             API server admission hook
┌──────────────┐        ┌─────────────────────────┐       ┌──────────────────────────────┐
│ RulePolicy   │ ─────▶ │ ValidationPolicy (CEL)  │ ────▶ │ on every AlertRule / Folder  │
│ FolderNaming │        │ ValidationPolicyBinding │       │ write: evaluate the policies │
│  Policy      │ ◀───── │   paramRef ─────────────┼──┐    │ of the namespace, then       │
└──────────────┘ params └─────────────────────────┘  │    │   Deny → 422, write rejected │
        ▲                                            │    │   Warn → admitted + warning  │
        └────────────────────────────────────────────┘    └──────────────────────────────┘
```

- **One policy and one binding per app resource.** `RulePolicy/ownership` becomes
  `ValidationPolicy/rulepolicy-ownership` and `ValidationPolicyBinding/rulepolicy-ownership`.
- **The policy's CEL is the same for every resource of an app.** What it checks comes from the
  binding's `paramRef`, which points back at the app resource. Editing the keys or the pattern
  takes effect immediately, without regenerating the policy.
- **`enforcement` becomes the binding's action.** `Deny` rejects the write with a 422 that names
  the field and explains what is wrong. `Warn` admits it and adds a warning to the response.
- **Several app resources in a namespace all apply.** A resource must satisfy every one of them.
- **Policies are type-checked** against the schemas of the kinds they target, both when written
  and when the admission hook compiles them.
- **Only Grafana apps write validation policies.** Users, including org admins, can read them but
  not create them. Org admins manage the app resources instead.

## Prerequisites

1. **A Grafana built from this branch, with the policy APIs enabled.** They are not served by
   default. Add the setting in [`grafana.ini`](grafana.ini) to `conf/custom.ini` and restart:

   ```ini
   [grafana-apiserver]
   runtime_config = policy.grafana.app/v0alpha1=true,rulepolicy.alerting.grafana.app/v0alpha1=true,foldernaming.grafana.app/v0alpha1=true
   ```

2. **A `gcx` context for that Grafana, signed in as an org admin.** For a local server, without
   touching any existing context:

   ```sh
   gcx config set stacks.policy-demo.grafana.server http://localhost:3000
   gcx config set stacks.policy-demo.grafana.user admin
   gcx config set stacks.policy-demo.grafana.org-id 1
   gcx config set contexts.policy-demo.stack policy-demo
   export GCX_CONTEXT=policy-demo GRAFANA_PASSWORD=admin
   ```

   `GRAFANA_PASSWORD` keeps the password out of the config file. To store it instead, run
   `gcx config set stacks.policy-demo.grafana.password admin`; gcx moves it into the system
   keychain.

   `gcx --context policy-demo resources list-types` should list `policy.grafana.app`,
   `rulepolicy.alerting.grafana.app` and `foldernaming.grafana.app`.

## Running the demo

```sh
./policy-demo/demo.sh            # walk through every step, pausing in between
./policy-demo/demo.sh cleanup    # delete everything the demo created
```

| Variable      | Effect                                                                         |
| ------------- | ------------------------------------------------------------------------------ |
| `GCX_CONTEXT` | gcx context to use (default: the current context)                              |
| `GCX_CONFIG`  | gcx config file to use                                                         |
| `DEMO_PAUSE`  | `1` to pause between steps, `0` not to (default: pause when run in a terminal) |
| `DEMO_WAIT`   | seconds to wait for the apps to write their policies (default: 30)             |

The script starts by deleting anything left from a previous run. It checks every step against
its expected outcome and marks it ✔ or ✘. It leaves the demo's resources in place at the end, so
they can be shown in the UI.

`gcx` only prints the API server's warnings at its highest verbosity, so the script pushes with
`-vvv` and keeps just the warning and result lines. When applying the `warned-*` examples by
hand, add `-vvv` to see their warnings.

## The examples

Each file can be applied on its own with `gcx resources push -p <file>`. They are numbered in the
order the demo applies them, because later examples rely on earlier ones: the alert rules live in
the folder from `02-folders/compliant-folder.yaml`, and the policies must exist before anything
is denied.

### 00-before-policies

| File                 | Outcome | Why                                                                                       |
| -------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `legacy-folder.yaml` | Created | No policy exists yet. Its title, `Legacy Alerts`, breaks the conventions introduced next. |

### 01-policies: what admins write

| File                             | What it requires                                                                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rule-policy-ownership.yaml`     | **Deny.** Every alert rule needs non-empty `team` and `severity` labels and a `runbook_url` annotation, and must not carry `tmp` or `test` labels. |
| `rule-policy-documentation.yaml` | **Warn.** Alert rules should have `summary` and `description` annotations.                                                                         |
| `folder-naming-team-prefix.yaml` | **Deny.** Folder titles must match `[a-z0-9-]+: .+`, like `platform: Alerts`.                                                                      |
| `folder-naming-length.yaml`      | **Warn.** Folder titles should be 40 characters or fewer.                                                                                          |

A few seconds after these are applied, the reconcilers have written one policy and one binding
for each. To see them:

```sh
gcx resources get validationpolicybindings.v0alpha1.policy.grafana.app
gcx resources get validationpolicies.v0alpha1.policy.grafana.app/rulepolicy-ownership -o yaml
```

### 02-folders

| File                         | Outcome                 | Why                                                                                                                                               |
| ---------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compliant-folder.yaml`      | Created                 | `platform: Alerts` follows both conventions.                                                                                                      |
| `denied-no-team-prefix.yaml` | **Denied**              | `Platform Dashboards` has no team prefix.                                                                                                         |
| `warned-long-title.yaml`     | Created, with a warning | Has a team prefix but is longer than 40 characters, which is only a `Warn`.                                                                       |
| `legacy-folder-updated.yaml` | Updated                 | Changes the legacy folder's description, not its title. Only creates and renames are checked, so folders that predate a convention stay editable. |
| `denied-legacy-rename.yaml`  | **Denied**              | Renames the legacy folder to `Old Alerts`, which breaks the convention.                                                                           |
| `legacy-rename.yaml`         | Updated                 | Renames it to `platform: Legacy alerts`, which follows the convention.                                                                            |

A denied folder looks like this:

```
422 Invalid: Folder.folder.grafana.app "platform-dashboards" is invalid: spec.title: Invalid value: null:
ValidationPolicy "foldernaming-team-prefix" with binding "foldernaming-team-prefix": folder title
"Platform Dashboards" does not follow the naming convention: start with the owning team in
lowercase, like 'platform: Alerts'
```

### 03-alert-rules

The rules use a server-side math expression, so no datasource is needed.

| File                            | Outcome                 | Why                                                                                       |
| ------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| `compliant-rule.yaml`           | Created                 | Has every required label and annotation, and no forbidden one.                            |
| `denied-missing-ownership.yaml` | **Denied**              | No `team`, a blank `severity`, and no `runbook_url`. One error lists all of them.         |
| `denied-forbidden-label.yaml`   | **Denied**              | Carries a `tmp` label. A forbidden key is rejected even when its value is empty.          |
| `warned-undocumented.yaml`      | Created, with a warning | Meets the ownership policy but has no `summary` or `description`, which is only a `Warn`. |

A denied rule, and a warned one:

```
422 Invalid: AlertRule.rules.alerting.grafana.app "disk-almost-full" is invalid: [
  spec.labels: ... ValidationPolicy "rulepolicy-ownership" with binding "rulepolicy-ownership": labels missing or empty: team, severity,
  spec.annotations: ... ValidationPolicy "rulepolicy-ownership" with binding "rulepolicy-ownership": annotations missing or empty: runbook_url]

Warning: ValidationPolicy "rulepolicy-documentation" with binding "rulepolicy-documentation":
annotations missing or empty: summary, description
```

### 04-guardrails: the policies protect themselves

| File                                        | Outcome       | Why                                                                                                                                                |
| ------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `denied-handwritten-validation-policy.yaml` | **Forbidden** | Users cannot write `ValidationPolicy` resources, not even org admins. Only Grafana apps do.                                                        |
| `denied-conflicting-rule-policy.yaml`       | **Rejected**  | `team` is both required and forbidden, so no rule could ever satisfy it.                                                                           |
| `denied-invalid-folder-pattern.yaml`        | **Rejected**  | Look-behind is not valid RE2, the regex engine CEL uses. A bad pattern is caught when the policy is written, not on every folder write afterwards. |

The last two come back as `403 Forbidden` with the field error in the message, rather than as a 422. The app SDK reports every rejection from an app's own validator that way. Rejections of
alert rules and folders come from the policy admission hook and are proper `422 Invalid` errors.

## Things to know

- **Enforcement starts a few seconds after an app resource is written.** The reconciler writes
  the policy and binding, and the admission hook picks them up from its watch. The demo script
  waits for each binding before continuing.
- **Policies apply to writes that go through the app platform APIs.** That includes `gcx`,
  `kubectl`-style clients and anything else that writes through `/apis`. The demo writes
  everything through `gcx`.
- **Deleting an app resource removes its policy and binding**, so nothing it required is enforced
  any more.
