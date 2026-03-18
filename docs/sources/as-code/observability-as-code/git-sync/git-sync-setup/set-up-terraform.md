---
description: Instructions for setting up Git Sync as code, so you can provision Git repositories for use with Grafana.
keywords:
  - set up
  - git integration
  - git sync
  - github
  - terraform
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Set up Git Sync with Terraform
weight: 210
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/git-sync-setup/set-up-terraform
aliases:
---

# Set up Git Sync with Terraform

{{< admonition type="caution" >}}

Git Sync is available in [public preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud, and is an [experimental feature](https://grafana.com/docs/release-life-cycle/) in Grafana v12 for open source and Enterprise editions. Documentation and support is available **based on the different tiers** but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided.

**Git Sync is under development.** Refer to [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits) for more information. [Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

You can also configure Git Sync using Terraform. 

## Set up Git Sync for GitHub with Terraform 

