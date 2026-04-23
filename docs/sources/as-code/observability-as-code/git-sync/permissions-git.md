---
description: Learn how to protect your Git repository and control who can read or write dashboard source code when using Git Sync.
keywords:
  - git sync
  - repository protection
  - repository access control
  - repository permissions
  - branch protection
  - security
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Configure Git repository protection
menuTitle: Git repository protection
weight: 710
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/repository-protection/
---

# Configure Git repository protection

{{< admonition type="note" >}}

**Git Sync is now GA for Grafana Cloud, OSS and Enterprise.** Refer to [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits) to understand usage limits for the different tiers.

[Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

When you use Git Sync, your dashboard configurations are stored as code in a Git repository. Git repository protection controls who can access this source code and who can modify it. This guide explains how to configure repository access at your Git provider to protect your dashboard source code.

{{< admonition type="note" >}}
Repository protection works as an additional security layer after Grafana internal permissions. For information about Grafana permissions, refer to [Git Sync permissions and access control](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/permissions-grafana).
{{< /admonition >}}

## Required permissions at the Git provider level

Git Sync authentication credentials must have specific permissions at your Git provider:

**Required for all configurations**:

- Read access to repository contents
- Read access to branch information

**Required for writing changes**:

- Write access to create commits
- Permission to create pull requests (when branch protection is enabled)
- Permission to push to feature branches (for creating pull requests)

**Optional for instant synchronization**:

- Permission to create and manage webhooks

Refer to the [Git Sync setup documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup) for detailed instructions on configuring authentication for your Git provider.

## Control access to the dashboards source code

You can access dashboard source code through two paths, each with its own protection mechanism:

- **Grafana files endpoint**: Users can view and edit dashboard source code through the Grafana files API endpoint. Use Grafana folder and dashboard permissions to control this access. Refer to [Manage access to dashboard source code via the API](#manage-access-to-dashboard-source-code-via-the-api) for more information.

- **Git repository**: Users with repository access can view and modify dashboard files directly in Git. You can control repository permissions in your Git provider. Refer to [Control access to your Git repository ](#control-access-to-your-git-repository) for more information.

Protect both access points to secure your dashboard configurations.

## Manage access to dashboard source code via the API

### View dashboard source code

You can view dashboard source code through the files endpoint if you have **Viewer** permission or higher on the dashboard or its parent folder. This allows you to:

- List files in provisioned folders and branches
- Read dashboard JSON content
- View folder structure and organization

### Edit dashboard source code

You can modify dashboard source code through the files endpoint if you have **Editor** or **Admin** permission on the dashboard or its parent folder. This allows you to:

- Create new dashboard files
- Update existing dashboard content
- Delete dashboards
- Modify folder structure

When you save changes through this endpoint, Git Sync commits those changes to the Git repository (or creates pull requests if branch protection is enabled), subject to Git repository permissions.

For detailed information about configuring folder and dashboard permissions in Grafana, refer to [Git Sync permissions and access control](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/permissions-grafana).

## Control access to your Git repository

Access control at the Git provider level determines who can view and modify your dashboard source code. Configure repository access based on your security and compliance requirements.

### Read access (repository visibility)

Read access controls who can view the dashboard source code stored in your repository. This includes dashboard JSON files, folder structure, and any other files in the repository.

**Public repositories**: Anyone can view the repository contents, including dashboard configurations and any data or queries they contain. Only use public repositories if your dashboards contain no sensitive information.

**Private repositories**: Only authorized users can view repository contents. This protects dashboard configurations, queries, and any embedded credentials or sensitive data from public access.

For Git Sync to function, the authentication credentials configured in Grafana must have read access to pull dashboard changes from Git to Grafana.

### Write access (push permissions)

Write access controls who can push changes to your repository. This determines who can modify dashboard source code, either directly or through pull requests.

**Direct write access**: Users with write permission can push commits directly to branches. For Git Sync to push dashboard changes from Grafana to Git, the authentication credentials must have write access to the repository.

**Protected branches**: Branch protection rules can restrict direct writes and require changes to go through pull requests with review and approval, even for users with write access.

Refer to the [Git Sync setup documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup) for detailed instructions on configuring authentication for your Git provider.

## Control how changes are written in Git Sync

Git Sync supports different modes for writing dashboard changes to your repository, from allowing direct commits to requiring formal review processes.

### Read-only mode

Configure the repository as read-only in Grafana to prevent any writes to Git from the Grafana UI. Dashboards sync from Git to Grafana, but users cannot save changes back to Git.

**Use when**: Git is the single source of truth and all changes must be made through direct Git commits or CI/CD processes.

### Direct commit mode

When the repository allows writes and branch protection is not enabled, Git Sync commits dashboard changes directly to the configured branch without review.

**Use when**: Rapid iteration is needed and changes don't require formal review, such as in development environments.

### Pull request mode

When branch protection is enabled at your Git provider, Git Sync creates pull requests instead of committing directly. Changes require review and approval before merging to the main branch.

**Use when**: Changes require review and approval, such as in production environments or when multiple teams collaborate on dashboards.

## Protect your branch

Branch protection rules at your Git provider enforce how changes are made to specific branches. When enabled on the branch that Git Sync targets, these rules require Git Sync to create pull requests instead of pushing commits directly.

**Common use cases for branch protection**:

- Production environments requiring change approval
- Compliance requirements for audit trails and review
- Multi-team environments where changes need visibility

Branch protection can enforce various controls such as requiring pull requests before merging, setting reviewer approval requirements, running automated validation checks, preventing force pushes, and restricting who can push directly to protected branches.

Refer to your Git provider's documentation for specific instructions on configuring branch protection rules.

## Code review assignments

Many Git providers support `CODEOWNERS` files that automatically assign reviewers to pull requests based on which files are changed. When Git Sync creates a pull request, the Git provider can use the `CODEOWNERS` file to assign the appropriate team or users for review.

This ensures dashboard changes are reviewed by the teams responsible for those dashboards, based on folder path or file patterns.

Refer to your Git provider's documentation for instructions on configuring `CODEOWNERS` files.

## Troubleshooting

### Git Sync fails with "403 Forbidden" or "Unauthorized"

**Cause**: The authentication credentials lack the required repository permissions.

**Solution**:

1. Verify the credentials have read and write access to the repository
2. Check that the credentials can create pull requests (if branch protection is enabled)
3. Verify authentication credentials haven't expired
4. For GitHub Apps, verify the app is installed and authorized for the repository

### Dashboard changes commit directly without review

**Cause**: Branch protection is not configured at the Git provider.

**Solution**:

1. Enable branch protection on the target branch at your Git provider
2. Configure the branch to require pull requests before merging
3. Verify the branch name in protection rules matches the branch configured in Grafana

### Pull requests not created when expected

**Cause**: Branch protection is not enabled or the authentication credentials lack pull request creation permission.

**Solution**:

1. Verify branch protection is enabled on the correct branch
2. Check that the credentials have permission to create pull requests
3. Ensure the branch name in Git Sync settings matches the protected branch exactly
