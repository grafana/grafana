---
description: Instructions for extending Git Sync.
keywords:
  - set up
  - git integration
  - git sync
  - github
  - extend
  - image rendering
  - real-time notifications
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Extend Git Sync
weight: 300
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/git-sync-setup/set-up-extend/
aliases:
---

# Extend Git Sync for real-time notification and image rendering

{{< admonition type="caution" >}}

Git Sync is available in [public preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud, and is an [experimental feature](https://grafana.com/docs/release-life-cycle/) in Grafana v12 for open source and Enterprise editions. Documentation and support is available **based on the different tiers** but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided.

**Git Sync is under development.** Refer to [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits) for more information. [Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

After [set-up](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/), you can optionally extend Git Sync by enabling pull request notifications and image previews of dashboard changes.

| Capability                                       | Benefit                                                           | Requires                               |
| ------------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------- |
| A table summarizing changes to your pull request | A convenient way to save changes back to GitHub                   | Webhooks configured                    |
| A dashboard preview image to a PR                | A snapshot of dashboard changes to a pull request outside Grafana | Image renderer and webhooks configured |

## Set up webhooks for real-time notification and pull request integration

Real-time notifications (or automatic pulling) is enabled and configured by default in Grafana Cloud.

In Grafana OSS/Enterprise, Git Sync uses webhooks to enable real-time updates from GitHub public repositories, or to enable pull request integrations. Without webhooks the polling interval is set during configuration, and is 60 seconds by default. You can set up webhooks with whichever service or tooling you prefer: Cloudflare Tunnels with a Cloudflare-managed domain, port-forwarding and DNS options, or a tool such as `ngrok`.

To set up webhooks:

1. Expose your Grafana instance to the public Internet.

- Use port forwarding and DNS, a tool such as `ngrok`, or any other method you prefer.
- The permissions set in your GitHub access token provide the authorization for this communication.

1. After you have the public URL, add it to your Grafana configuration file:

```ini
[server]
root_url = https://<PUBLIC_DOMAIN>
```

1. Replace _`<PUBLIC_DOMAIN>`_ with your public domain.

To check the configured webhooks, go to **Administration > General > Provisioning** and click the **View** link for your GitHub repository.

### Expose necessary paths only

If your security setup doesn't permit publicly exposing the Grafana instance, you can either choose to allowlist the GitHub IP addresses, or expose only the necessary paths.

The necessary paths required to be exposed are, in RegExp:

- `/apis/provisioning\.grafana\.app/v0(alpha1)?/namespaces/[^/]+/repositories/[^/]+/(webhook|render/.*)$`

## Set up image rendering for dashboard previews

{{< admonition type="caution" >}}

Only available in Grafana OSS and Grafana Enterprise.

{{< /admonition >}}

Set up image rendering to add visual previews of dashboard updates directly in pull requests. Image rendering also requires webhooks.

To enable this capability, install the Grafana Image Renderer in your Grafana instance. For more information and installation instructions, refer to the [Image Renderer service](https://github.com/grafana/grafana-image-renderer).

## Next steps

To learn more about using Git Sync refer to the following documents:

- [Set up Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/)
- [Export resources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/export-resources/)
- [Work with provisioned repositories](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/use-git-sync/)
- [Work with provisioned dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/provisioned-dashboards/)
- [Git Sync deployment scenarios](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-deployment-scenarios)

