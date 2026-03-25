# Git Sync Gotchas

Common pitfalls and workarounds for browser automation of the Git Sync provisioning wizard.

## Kubernetes Reconciliation Delays

Every Next button click that submits data triggers a K8s resource write + reconciliation. The UI shows "Submitting..." on the button. **Never click the next element until the new step heading is visible.** Always `wait_for` the next step's title text or a known element on the new step.

## FormPrompt (Unsaved Changes Dialog)

The wizard uses `FormPrompt` which intercepts navigation when the form is dirty. This is active during the **bootstrap** and **synchronize** steps (not authType, connection, or finish). If you navigate away (e.g., back button or URL change) during these steps, a browser dialog appears asking to confirm. Use `handle_dialog` with `action: "accept"` if this happens.

## Loading States

Each step loads data asynchronously. Take a snapshot and check for these loading indicators before interacting:

- Bootstrap: "Loading resource information..."
- Synchronize: "Checking repository status..."

## Combobox Fields

Branch, path, and repository URL (in GitHub App mode) use `Combobox` components, not plain `input` elements. In the snapshot, they appear as `combobox` role. To interact:

1. `click` the combobox to open the dropdown
2. Either `type_text` to filter, then `click` the desired option from the dropdown
3. Or for **free-text entry** (e.g., a branch not in the pre-populated list): click the "Clear value" button if a value is pre-filled, `click` the combobox, `type_text` the value, then press `Enter`. The dropdown may appear empty — this is expected; `Enter` commits the typed value.

## Step Heading as Navigation Confirmation

The step heading format is `{n}. {title}` (e.g., "2. Configure repository"). Use this pattern in `wait_for` to confirm step transitions completed. **Always wait for the full heading with the step number** (e.g., `"3. Choose what to synchronize"`) rather than just the title text, to avoid false matches against the step indicator labels in the sidebar.

## Button Disabled States

The Next button may be disabled when:

- Form validation fails (required fields empty)
- Data is loading
- On the synchronize step: until the sync job completes successfully
- During submission ("Submitting..." state)

Always `take_snapshot` to verify the button is enabled before clicking.

## `wait_for` Timeout Cap

The Chrome DevTools MCP `wait_for` tool has a **hard 30-second internal timeout** regardless of the `timeout` value you pass. Any `wait_for` call that needs more than 30s will fail. For short waits (step transitions, button states), `wait_for` works fine. For long-running operations (sync jobs on large repos), **poll with `take_snapshot`** every 10-15s instead.

## Branch Must Exist

The `agent-test` branch (or whatever branch you configure in Step 2) must already exist on the remote repository. The wizard validates the branch and will error with `branch "X" not found` if it does not exist.

## Path Conflicts Across Repositories

When connecting more than one repository in different runs, use different path names in Step 2 to avoid conflicts. If two repositories sync to the same path (e.g., both use `dev`), the second connection may fail or overwrite the first. Use distinct paths per auth type (e.g., `dev/pat-test` for PAT, `dev/app-test` for GitHub App).
