---
name: github-app
description: >
  Use when asked to test the GitHub App wizard flow of Git Sync provisioning.
  Runs the 5-step wizard with GitHub App auth (connection creation, PEM
  injection), verifies the repository was created, and cleans up the repository
  and connection.
---

# Git Sync GitHub App Wizard E2E Testing

Drive the Grafana provisioning wizard through the browser using `mcp_chrome_devtools_*` tools with GitHub App authentication.

## Execution Rules

**This is a test-only run.** Read `../shared/execution-rules.md` FIRST and follow all of its rules: no code changes, do not stop on failure, complete the entire flow including cleanup, budget your time, and produce the final report in the format it defines.

## Prerequisites

### Required Feature Toggles

Grafana must have these feature toggles enabled: `provisioning`, `kubernetesDashboards`, and `provisioningFolderMetadata`.

### Required Secrets

| Variable                                    | Description                          |
| ------------------------------------------- | ------------------------------------ |
| `GIT_SYNC_TEST_APP_REPO_URL`                | GitHub repo URL for GitHub App flow  |
| `GIT_SYNC_TEST_GITHUB_APP_ID`               | GitHub App ID, numeric               |
| `GIT_SYNC_TEST_GITHUB_APP_INSTALLATION_ID`  | GitHub App Installation ID, numeric  |
| `GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH` | Path to PEM private key file (local) |
| `GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY`      | PEM private key content (cloud)      |

Locally, `GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH` points to the PEM file. On cloud, `GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY` contains the PEM content directly.

### Setup

Follow "Local Setup" (or "Cloud Setup" on a cloud VM) in `../shared/setup.md`. Verify each variable from the Required Secrets table above is set before proceeding.

### Cleanup Before Testing

Before running the GitHub App flow, delete existing test resources to avoid conflicts:

Run `bash .claude/skills/git-sync/shared/scripts/cleanup-provisioning.sh`

## Shared References

Read these files during execution for detailed operation steps, gotchas, and selectors:

- **Operations** (Steps 2-5, create/move/delete, cleanup): `../shared/operations.md`
- **Gotchas** (reconciliation delays, combobox quirks, timeouts): `../shared/gotchas.md`
- **Selectors** (element IDs, roles, placeholders): `../shared/selectors.md`
- **API reference** (cleanup & verification endpoints): `../shared/api.md`

## GitHub App Wizard Step 1: Connect (authType)

Requires `$GIT_SYNC_TEST_APP_REPO_URL`, `$GIT_SYNC_TEST_GITHUB_APP_ID`, `$GIT_SYNC_TEST_GITHUB_APP_INSTALLATION_ID`, and the PEM private key (via `$GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH` locally or `$GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY` on cloud).

1. `navigate_page` to `http://localhost:3000/admin/provisioning/connect/github`
2. `wait_for` text `["Connect with GitHub App"]`
3. "Connect with GitHub App" is selected by default (value: `github-app`)

**Creating a new connection:**

4. If no connections exist, mode auto-selects "Connect to a new app". Otherwise, `click` the "Connect to a new app" radio option.
5. `fill` the title input (id: `title`, placeholder: `My GitHub App`) -- pick any descriptive name
6. `fill` the App ID input (id: `appID`, placeholder: `123456`) with `$GIT_SYNC_TEST_GITHUB_APP_ID`
7. `fill` the Installation ID input (id: `installationID`, placeholder: `12345678`) with `$GIT_SYNC_TEST_GITHUB_APP_INSTALLATION_ID`
8. The private key textarea (id: `privateKey`) **does not accept multiline content via `fill`**. Instead, get the PEM content (from `$GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH` file locally, or `$GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY` env var on cloud) and inject it via `evaluate_script`:
   ```js
   (pemContent) => {
     const ta = document.querySelector('textarea');
     const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
     setter.call(ta, pemContent);
     ta.dispatchEvent(new Event('input', { bubbles: true }));
     ta.dispatchEvent(new Event('change', { bubbles: true }));
   };
   ```
   Pass the PEM string as an argument. Cloud secret stores often flatten the multiline PEM to a single line — literal `\n` escapes, newlines replaced by spaces, or base64 of the whole PEM file. Normalize before injecting: `pem=$(bash .claude/skills/git-sync/shared/scripts/normalize-pem.sh)` — prints a parseable multiline PEM to stdout, or exits non-zero with a diagnostic that never echoes key material. Treat `$pem` as a secret: never `echo` it, write it to a file, paste it into snapshots or the final report, or quote it when a step fails — refer to it by variable name only.
9. `click` "Create connection"
10. **Wait:** The connection status shows "Pending" after creation. **Known bug: the UI does not auto-update the connection status** (no WebSocket push, no polling). The connection becomes ready within ~10s on the backend. **Workaround:** `navigate_page` to reload the wizard page, then switch to "Choose an existing app" and select the connection from the dropdown. It will show "Connected".

**Using an existing connection:**

4. `click` the "Choose an existing app" radio option
5. `click` the connection combobox (placeholder: `Select a GitHub App connection`)
6. **Combobox options may not appear in `take_snapshot`** a11y output. Use `evaluate_script` to inspect the DOM:
   ```js
   () => {
     const options = document.querySelectorAll('[role="option"]');
     return Array.from(options).map((o) => ({ id: o.id, text: o.textContent.trim() }));
   };
   ```
   Then click the target option by DOM id via `evaluate_script`:
   ```js
   () => document.getElementById('combobox-option-<id>').click();
   ```

**After connection is selected/created:**

11. The repository URL field becomes a combobox populated from the connection's repos.
12. `take_snapshot` to find the repo combobox. `click` it, then `type_text` to filter for the repo matching `$GIT_SYNC_TEST_APP_REPO_URL`. **Options may not appear in the a11y snapshot** -- use `evaluate_script` to inspect and click the correct `[role="option"]` by DOM id (same technique as step 6 above).
13. `click` "Configure repository"

**Wait:** Same as PAT flow -- `wait_for` step 2 heading with **30s timeout**.

**Continue with Steps 2-5** from `../shared/operations.md`. Steps 2-5 are identical to the PAT flow.

**Use path `dev/app-test` in Step 2** to avoid conflicts with other flows (see "Path Conflicts Across Repositories" gotcha).

## Post-Wizard Verification

After Step 5 completes and the page navigates to `/admin/provisioning/{repoName}`:

1. Verify via API that the repository exists with type github and the expected URL — see "Verification Checks" in ../shared/api.md.

2. Navigate to the provisioned folder in the browse view and confirm it exists.

## Cleanup

Remove the repository and connection, then verify no artifacts remain:

Run `bash .claude/skills/git-sync/shared/scripts/cleanup-provisioning.sh`
