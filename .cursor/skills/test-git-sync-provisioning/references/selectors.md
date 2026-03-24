# Element Selectors Reference

Organized by wizard step. No `data-testid` attributes exist in the wizard -- use ids, roles, labels, and placeholders.

## Step 1: Connect (authType)

### Auth Type Radio Buttons

| Element          | Selector Strategy                            | Details                                                |
| ---------------- | -------------------------------------------- | ------------------------------------------------------ |
| GitHub App radio | RadioButtonGroup option, value: `github-app` | Label: "Connect with GitHub App". Selected by default. |
| PAT radio        | RadioButtonGroup option, value: `pat`        | Label: "Connect with Personal Access Token"            |

### PAT Fields

| Element        | ID               | Placeholder                           | Notes                                                      |
| -------------- | ---------------- | ------------------------------------- | ---------------------------------------------------------- |
| Token          | `token`          | `ghp_xxxxxxxxxxxxxxxxxxxx`            | `SecretInput` component -- has show/hide toggle            |
| Repository URL | `repository-url` | `https://github.com/owner/repository` | Plain `Input`                                              |
| Token User     | `tokenUser`      | `username`                            | Not shown for GitHub PAT flow (only Bitbucket/generic Git) |

### GitHub App Mode Selection

| Element               | Selector Strategy           | Details                         |
| --------------------- | --------------------------- | ------------------------------- |
| Mode RadioButtonGroup | field name: `githubAppMode` | Two options below               |
| Existing app          | value: `existing`           | Label: "Choose an existing app" |
| New app               | value: `new`                | Label: "Connect to a new app"   |

### GitHub App -- New Connection Fields

| Element           | ID               | Placeholder                          | Required                       |
| ----------------- | ---------------- | ------------------------------------ | ------------------------------ |
| Title             | `title`          | `My GitHub App`                      | Yes                            |
| Description       | `description`    | `Optional description`               | No                             |
| App ID            | `appID`          | `123456`                             | Yes                            |
| Installation ID   | `installationID` | `12345678`                           | Yes                            |
| Private Key (PEM) | `privateKey`     | `-----BEGIN RSA PRIVATE KEY-----...` | Yes, `SecretTextArea` (8 rows) |

### GitHub App -- Existing Connection

| Element                 | Selector Strategy                                              | Details                                 |
| ----------------------- | -------------------------------------------------------------- | --------------------------------------- |
| Connection Combobox     | `combobox` role, placeholder: `Select a GitHub App connection` | Lists available connections             |
| Connection Status Badge | Adjacent to combobox                                           | Shows connection health after selection |

### GitHub App -- Repo URL

| Element             | Selector Strategy | Details                                                               |
| ------------------- | ----------------- | --------------------------------------------------------------------- |
| Repository Combobox | `combobox` role   | Populated from connection's repos. Appears after connection selected. |

### Buttons

| Element               | Text                   | Notes                                                         |
| --------------------- | ---------------------- | ------------------------------------------------------------- |
| Create Connection     | `Create connection`    | GitHub App "new" mode only. Loading: `Creating connection...` |
| Next (Configure Repo) | `Configure repository` | Form submit button. Loading: `Submitting...`                  |
| Cancel                | `Cancel`               | Left button on authType step                                  |

## Step 2: Configure Repository (connection)

### Fields

| Element | Selector Strategy             | Placeholder | Notes                                        |
| ------- | ----------------------------- | ----------- | -------------------------------------------- |
| Branch  | First `combobox` on the step  | `main`      | Auto-populated from repo refs API. Required. |
| Path    | Second `combobox` on the step | (empty)     | Optional. Subdirectory path.                 |

### Buttons

| Element  | Text                         | Notes                                       |
| -------- | ---------------------------- | ------------------------------------------- |
| Next     | `Choose what to synchronize` | Form submit                                 |
| Previous | `Cancel`                     | For non-GitHub types; `Previous` for GitHub |

## Step 3: Choose What to Synchronize (bootstrap)

### Loading State

| Indicator       | Text                              |
| --------------- | --------------------------------- |
| Loading spinner | `Loading resource information...` |

### Sync Target Cards

| Target   | Card Label                                      | Card Description Pattern        |
| -------- | ----------------------------------------------- | ------------------------------- |
| Instance | `Sync all resources with external storage`      | Syncs dashboards, folders, etc. |
| Folder   | `Sync external storage to a new Grafana folder` | Scoped to a single folder       |

Cards are `<article>` or clickable `<div>` elements. Click the card itself to select.

### Fields

| Element      | ID                 | Placeholder                | Notes                                     |
| ------------ | ------------------ | -------------------------- | ----------------------------------------- |
| Display Name | `repository-title` | `My repository connection` | Only shown for `folder` target. Required. |

### Buttons

| Element            | Text                                | Notes                                    |
| ------------------ | ----------------------------------- | ---------------------------------------- |
| Next (has content) | `Synchronize with external storage` | When repo/instance has resources to sync |
| Next (empty)       | `Choose additional settings`        | When nothing to sync (skips step 4)      |
| Previous           | `Previous`                          |                                          |

## Step 4: Synchronize (synchronize)

### Loading State

| Indicator       | Text                            |
| --------------- | ------------------------------- |
| Loading spinner | `Checking repository status...` |

### Elements

| Element                    | Selector Strategy                            | Notes                                                                                   |
| -------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| Begin Sync button          | `button` role, text: `Begin synchronization` | Primary action. Appears after loading.                                                  |
| Migrate Resources checkbox | id: `migrate-resources`                      | Conditional on `provisioningExport` feature toggle. Label: "Migrate existing resources" |
| Cancel button              | text: `Cancel`                               | Cancels sync job in progress. Loading: `Cancelling...`                                  |
| Job status                 | Text content changes                         | Shows "working"/"pending" during sync, progress bar                                     |

### Buttons

| Element | Text                         | Notes                                |
| ------- | ---------------------------- | ------------------------------------ |
| Next    | `Choose additional settings` | Enabled only after sync job succeeds |

## Step 5: Additional Settings (finish)

### Fields

| Element            | Selector Strategy | Placeholder / Default         | Notes                                                   |
| ------------------ | ----------------- | ----------------------------- | ------------------------------------------------------- |
| Sync Interval      | Number input      | `60`                          | Seconds. Git-based providers only.                      |
| Read Only          | Checkbox          | unchecked                     |                                                         |
| PR Workflow        | Checkbox          | unchecked                     | GitHub label: "Enable pull request option when saving"  |
| Push to Branch     | Checkbox          | unchecked                     |                                                         |
| Dashboard Previews | Checkbox          | unchecked                     | GitHub-only, conditional on image renderer availability |
| Webhook URL        | Text input        | `https://grafana.example.com` | GitHub-only                                             |

### Buttons

| Element | Text     | Notes                                                       |
| ------- | -------- | ----------------------------------------------------------- |
| Finish  | `Finish` | Final submit. Navigates to `/admin/provisioning/{repoName}` |
| Cancel  | `Cancel` | Left button                                                 |

## Step Heading Pattern

Every step renders a heading: `{visibleIndex + 1}. {stepTitle}`

| Step        | Heading Example                                               |
| ----------- | ------------------------------------------------------------- |
| authType    | `1. Connect`                                                  |
| connection  | `2. Configure repository`                                     |
| bootstrap   | `3. Choose what to synchronize`                               |
| synchronize | `4. Synchronize with external storage`                        |
| finish      | `5. Choose additional settings` (or `4.` if sync was skipped) |

Note: `visibleStepIndex` is 0-based, but displayed as 1-based. If the synchronize step is skipped, finish becomes step 4 instead of 5.

## Error States

| Context                     | Alert Title                                                       |
| --------------------------- | ----------------------------------------------------------------- |
| No GitHub connections       | "No GitHub connections found"                                     |
| Connection load failure     | "Failed to load connections"                                      |
| Connection creation failure | "Failed to create connection" (or field-specific errors from API) |
| Token validation failure    | Inline field error below the token input                          |
| URL validation failure      | "Must be a valid repository URL (https://hostname/owner/repo)"    |

## Save Provisioned Dashboard (Drawer)

### New Dashboard Fields

| Element       | ID                                  | Placeholder                                      | Notes                                                 |
| ------------- | ----------------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| Title         | `dashboard-title`                   | (none)                                           | Required for new dashboards                           |
| Description   | `dashboard-description`             | (none)                                           | Optional                                              |
| Target Folder | FolderPicker component              | (none)                                           | Pre-selected from URL's `folderUid`                   |
| Branch        | `provisioned-ref`                   | `Select or enter branch name`                    | Combobox with `createCustomValue`. Icon: branch icon. |
| Folder Path   | `folder-path`                       | `Select or enter folder path`                    | Combobox. Only for new dashboards.                    |
| Filename      | `dashboard-filename`                | (none)                                           | Input. Only for new dashboards.                       |
| Comment       | `provisioned-resource-form-comment` | `Add a note to describe your changes (optional)` | TextArea, 5 rows                                      |

### Existing Dashboard Fields

| Element | ID                                  | Notes           |
| ------- | ----------------------------------- | --------------- |
| Branch  | `provisioned-ref`                   | Same combobox   |
| Path    | `dashboard-path`                    | Read-only input |
| Comment | `provisioned-resource-form-comment` | Same textarea   |

### Tabs

| Tab     | Label     | Notes                               |
| ------- | --------- | ----------------------------------- |
| Details | "Details" | Default tab, shows save form        |
| Changes | "Changes" | Shows diff, only when changes exist |

### Buttons

| Button | Text                 | Notes                                                |
| ------ | -------------------- | ---------------------------------------------------- |
| Cancel | "Cancel"             | Secondary button                                     |
| Save   | "Save" / "Saving..." | Primary submit, disabled when not dirty or read-only |

## New Provisioned Folder (Drawer)

| Element     | ID                                  | Placeholder                                      | Notes                                          |
| ----------- | ----------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| Folder Name | `folder-name-input`                 | `Enter folder name`                              | Required. Alphanumeric, spaces, `_`, `-` only. |
| Branch      | `provisioned-ref`                   | `Select or enter branch name`                    | Same combobox as dashboard save                |
| Comment     | `provisioned-resource-form-comment` | `Add a note to describe your changes (optional)` | Same textarea                                  |

### Buttons

| Button | Text                     | Notes            |
| ------ | ------------------------ | ---------------- |
| Cancel | "Cancel"                 | Secondary button |
| Create | "Create" / "Creating..." | Primary submit   |

## Branch Dropdown Options

| Description Label     | Meaning                                                            |
| --------------------- | ------------------------------------------------------------------ |
| "Synchronized branch" | The configured branch (e.g., `agent-test`). Direct write workflow. |
| "Pull request branch" | Branch from a previous PR.                                         |
| "Last branch"         | Last branch used for this repo (from localStorage).                |
| "New branch"          | Custom-entered branch name.                                        |
| "(read-only)" suffix  | Push to configured branch is disabled.                             |

## PR Workflow Banners

| Element                      | Context                                                    |
| ---------------------------- | ---------------------------------------------------------- |
| "Pull request created" alert | Shown in folder creation form after branch workflow        |
| Preview banner with PR link  | Shown on dashboard preview page after branch workflow save |
| "View branch" button         | Links to branch in remote repo                             |
| "Compare branch" button      | Links to branch comparison in remote repo                  |
| "Open pull request" button   | Links to PR creation URL                                   |
