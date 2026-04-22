---
description: Learn about permissions and access control for Git Sync, including required Grafana roles and repository permissions.
keywords:
  - git sync
  - permissions
  - access control
  - rbac
  - roles
  - security
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Git Sync permissions and access control
menuTitle: Permissions and access control
weight: 700
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/permissions-and-access-control/
refs:
  roles-and-permissions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/cloud-roles/
  rbac:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/
  manage-dashboard-permissions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/manage-dashboards/#manage-dashboard-permissions
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/manage-dashboards/#manage-dashboard-permissions
  manage-folder-permissions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/organize-dashboards/manage-folders/#manage-folder-permissions
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/organize-dashboards/manage-folders/#manage-folder-permissions
---

# Git Sync permissions and access control

{{< admonition type="caution" >}}

**Git Sync is now GA for Grafana Cloud, OSS and Enterprise.** Refer to [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits) to understand usage limits for the different tiers.

[Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

For Git Sync you need to configure permissions at two layers to function correctly:

- At the Grafana level for repository management and resource access, as described in this document.
- At your Git provider level, to protect your repository. Refer to [Repository protection for Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/gitsync-repo-protection) for more information.

## Grafana role-based permissions

Git Sync integrates with the Grafana standard role-based permission model, which has three levels:

1. **Organization-level:** Default permissions of the `Admin`, `Editor`, or `Viewer` role. Refer to [Roles and permissions](ref:roles-and-permissions) for more details.
2. **Folder-level:** They also apply to all dashboards within it. Refer to [Folder permissions](ref:manage-folder-permissions) for more details.
3. **Dashboard-level:** Refer to [Dashboard permissions](ref:manage-dashboard-permissions) for more details.

{{< admonition type="caution" >}}

Dashboard-level permissions override folder-level permissions, which override organization-level roles.

{{< /admonition >}}

The following applies for Git Sync:

- **Permissions don't sync**: Folder and dashboard permissions are managed in Grafana only and don't sync to Git. You must configure permissions separately in each Grafana instance that uses the repository
- **Dashboard changes**: When users with appropriate dashboard or folder permissions modify dashboard content, those changes automatically sync to Git, or create pull requests if branch protection is enabled
- **Folder structure**: Creating, renaming, or deleting folders syncs to Git

## Use org-level permissions in Git Sync

If you apply org-level permissions, users can do the following with Git Sync:

### Admin users

Users with the `Admin` role can set up and manage Git Sync repositories and connections.

{{< admonition type="note" >}}
In Grafana Cloud, the equivalent role is **Grafana Cloud Admin** or **Admin** at the organization level.
{{< /admonition >}}

**Capabilities**:

- Configure new Git Sync repositories and connections
- Update repository settings (URL, branch, path, sync interval, webhook configuration)
- Delete repository connections
- Manage authentication credentials and Git provider connections
- Manually trigger sync operations (pull from Git)
- View sync status, logs, and statistics
- Access the Provisioning admin UI at **Administration > General > Provisioning**

### Viewer users

Users with the `Viewer` role can view provisioned resources. Their access to specific dashboards and folders depends on the permissions assigned to them.

**Organization-level capabilities**:

- Read Git Sync settings, via the `provisioning.settings:read` permission
- View dashboard preview links in pull requests

**Resource access** depends on folder and dashboard permissions:

- **Folder Viewer**: View all dashboards and subfolders within that folder
- **Dashboard Viewer**: View specific dashboards (even if they don't have folder access)
- Cannot edit dashboards or manage Git Sync repositories

### Editor users

Users with the `Editor` role can work with provisioned dashboards and folders. Their specific capabilities depend on the folder-level and dashboard-level permissions assigned to them.

**Organization-level capabilities**:

- View dashboard preview links in pull requests
- Trigger manual sync operations via jobs API

**Resource access** depends on folder/dashboard permissions:

- **Folder Editor or Admin**: Create, edit, and delete dashboards within the folder; create subfolders; changes sync to Git
- **Folder Viewer**: View dashboards only within that folder
- **Dashboard Editor or Admin**: Edit specific dashboards; changes sync to Git (even without folder edit access)
- **Dashboard Viewer**: View specific dashboards only

Editors don't need access to the Provisioning admin UI or repository configuration. Refer to [Configure folder and dashboard permissions](#configure-folder-and-dashboard-permissions) and [Configure fine-grained access control (RBAC)](#configure-fine-grained-access-control-rbac) for details.

## Configure folder and dashboard permissions

Folder-level role permissions determine who can view, edit, or delete provisioned resources.

These roles grant Grafana permissions (`dashboards:read`, `dashboards:write`, `folders:create`...) that are checked when users interact with provisioned resources through the Git Sync files endpoint. Dashboards within a provisioned folder inherit the folder's permissions.

When Git Sync creates a provisioned folder, it assigns these default permissions:

| Grafana Role | Folder Permission |
| ------------ | ----------------- |
| Admin        | Admin             |
| Editor       | Editor            |
| Viewer       | Viewer            |

**Folder-level `Viewer` users**:

- View dashboards and folders
- Cannot create, edit, or delete resources

**Folder-level `Editor` users**:

- Have all `Viewer` permissions
- Create, edit and delete dashboards
- Create subfolders
- When an `Editor` saves dashboard changes, Git Sync automatically commits the changes to Git, or creates a pull request if branch protection is enabled

**Folder-level `Admin` users**:

- Have all `Editor` permissions
- Update folder settings, rename and delete folders
- Modify folder permissions
- Full control over the folder and all its contents

### Modify folder-level permissions

{{< admonition type="caution" >}}
To safely modify permissions, each provisioned folder should include a `.folder.json` metadata file with the folder's UID. Without this file, folder permissions may be lost if the folder is moved to a different path in the Git repository.

For folders created from the Grafana UI, the metadata file is added automatically. If your folder is missing the metadata file, the UI shows a warning with instructions on how to add it.
{{< /admonition >}}

You can customize folder permissions using:

- **Grafana UI**: Navigate to the folder, click the settings icon, and select **Permissions**
- **RBAC (Enterprise/Cloud)**: Use [Role-Based Access Control](ref:rbac) for fine-grained permission management

## Configure fine-grained access control (RBAC)

If you're a Grafana Enterprise or Grafana Cloud user with RBAC enabled, Git Sync provides fine-grained permissions that allow more granular control over Git Sync operations. You can create custom roles that combine Git Sync permissions in different ways. Refer to [Role-Based Access Control](ref:rbac) documentation for instructions on creating and managing custom roles.

### How basic roles map to RBAC permissions

Understanding which permissions each basic role receives helps you create custom roles or understand exactly what access users have. The tables below show which Git Sync permissions are granted to each role by default.

{{< admonition type="note" >}}
The `provisioning.settings:read` permission is granted to all roles (Viewer and above) and allows viewing Git Sync system settings, which is necessary for the UI to display properly. This does not grant access to modify settings or manage repositories.
{{< /admonition >}}

#### Admin role

Users with the `Admin` role receive full access to Git Sync infrastructure:

| Permission Category      | Specific Permissions                                                                                                                              | What This Allows                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Repositories**         | `provisioning.repositories:create`<br>`provisioning.repositories:read`<br>`provisioning.repositories:write`<br>`provisioning.repositories:delete` | Create new repositories<br>View repository configurations<br>Update repository settings (branch, path, interval)<br>Delete repositories |
| **Connections**          | `provisioning.connections:create`<br>`provisioning.connections:read`<br>`provisioning.connections:write`<br>`provisioning.connections:delete`     | Create Git provider connections<br>View connection details<br>Update connection settings<br>Delete connections                          |
| **Jobs**                 | `provisioning.jobs:create`<br>`provisioning.jobs:read`<br>`provisioning.jobs:write`<br>`provisioning.jobs:delete`                                 | Trigger manual syncs<br>View sync jobs<br>Modify sync job settings<br>Cancel/delete sync jobs                                           |
| **History & Monitoring** | `provisioning.historicjobs:read`<br>`provisioning.stats:read`                                                                                     | View sync job history<br>View Git Sync statistics and metrics                                                                           |
| **Settings**             | `provisioning.settings:read`                                                                                                                      | View Git Sync system settings                                                                                                           |

#### Editor role

Users with the `Editor` role can manage sync operations but not infrastructure configuration:

| Permission Category  | Specific Permissions                                                                                              | What This Allows                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Jobs**             | `provisioning.jobs:create`<br>`provisioning.jobs:read`<br>`provisioning.jobs:write`<br>`provisioning.jobs:delete` | Trigger manual syncs<br>View sync jobs<br>Modify sync job settings<br>Cancel/delete sync jobs |
| **Read-Only Access** | `provisioning.repositories:read`<br>`provisioning.settings:read`                                                  | View repository configurations<br>View Git Sync settings                                      |

`Editors` can access resources based on the folder/dashboard assignments:

- `dashboards:create`, `dashboards:read`, `dashboards:write`, `dashboards:delete` - On folders/dashboards where assigned Folder Editor or Dashboard Editor
- `folders:create`, `folders:read`, `folders:write`, `folders:delete` - On folders where assigned Folder Editor

#### Viewer role

Users with Viewer role have read-only access to Git Sync:

| Permission Category  | Specific Permissions                                             | What This Allows                                                           |
| -------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Read-Only Access** | `provisioning.repositories:read`<br>`provisioning.settings:read` | View repository configurations<br>View Git Sync settings (required for UI) |

`Viewers` can access resources based on the folder/dashboard assignments:

- `dashboards:read` - On folders/dashboards where assigned Folder Viewer or Dashboard Viewer
- `folders:read` - On folders where assigned Folder Viewer

### RBAC for dashboards and folders

Provisioned dashboards and folders use the Grafana standard permission model. To modify provisioned resources, you will need permissions over your dashboard and folder.

The following applies for Git Sync:

- Users need standard `dashboards:*` and `folders:*` permissions to work with provisioned resources
- `Editors` and `Viewers` need `provisioning.settings:read` and `provisioning.repositories:read` to view Git Sync configuration
- Users do **not** need repository write/delete or connection permissions to edit dashboards
- Dashboard-level permissions override folder-level permissions
- Changes made by users with appropriate permissions automatically sync to Git

## Configure Git repository protection

After you've configured your Grafana permissions, set up the appropriate permissions at your Git provider to write changes. Repository protection settings control write access, branch protection rules, and code review requirements.

For detailed information about configuring repository write access and branch protection, refer to [Repository protection for Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/gitsync-repo-protection).

## Troubleshoot permissions

### "Permission denied" when saving a dashboard

**Cause**: User lacks **Editor** or **Admin** permission on the provisioned folder.

**Solution**:

1. Verify the user's folder-level permissions in Grafana
2. Navigate to **Folder settings > Permissions**
3. Grant the user or their team **Editor** or **Admin** role

### Git Sync fails with "403 Forbidden" or "Unauthorized"

**Cause**: The Git provider credentials lack the required permissions.

**Solution**:

1. Verify the authentication credentials (GitHub App, Personal Access Token, etc.) have **read and write** permissions on the repository
2. Check that the credentials have permission to create pull requests (if branch protection is enabled)
3. If using a GitHub App or OAuth app, verify it is installed and authorized for the target repository
4. For expired or revoked tokens, generate new credentials and update the Git Sync connection configuration

### Dashboard changes commit directly instead of creating pull requests

**Cause**: Branch protection is not configured at the Git provider.

**Solution**: Enable branch protection rules at your Git provider to enforce pull request workflows or in your Grafana repository settings. Refer to your Git provider's documentation for instructions on configuring branch protection.
