---
description: Strategies for upgrading your self-managed Grafana instance
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
title: Strategies for upgrading your self-managed Grafana instance
menuTitle: Upgrade strategies
weight: 1
---

# Strategies for upgrading your self-managed Grafana instance

At Grafana Labs, we believe in shipping features early and often, and in recent years we’ve increased our commitment to that philosophy.

We no longer wait for the yearly major release to give you access to the next big improvement. Instead, we regularly make new features, bug fixes, and security patches available to our self-managing users ([Grafana OSS](https://grafana.com/oss/grafana/) and [Grafana Enterprise](https://grafana.com/products/enterprise/)) throughout the year.

Having a dependable release process provides users like you with the best Grafana experience possible, and it provides the flexibility to upgrade in a manner that works best for you and your organization.

{{< admonition type="note" >}}
Grafana Cloud follows a different release cadence than Grafana OSS and Enterprise. In Cloud, Grafana uses Rolling release channels. To learn more about release channels, refer to [Rolling release channels for Grafana Cloud](https://grafana.com/docs/rolling-release/).
{{< /admonition >}}

## What to expect from each release type

We split Grafana OSS and Grafana Enterprise releases into three main categories:

- **Minor release (every other month)**: These releases can include new features, deprecation notices, notices about upcoming breaking changes, previously announced breaking changes, bug fixes, and security vulnerability patches.
- **Major release (once a year, in April/May)**: These are like a minor release, but accompanied by [GrafanaCON](https://grafana.com/events/grafanacon/) and a comprehensive upgrade guide for users who like to upgrade only once a year.
- **Patching release (every month)**: These include bug fixes for currently supported versions, as well as any security vulnerability patches.

You can choose your cadence: For frequent self-managed updates, you should follow the minor release (for example, upgrade 11.1 to 11.2), which also gives you access to the latest features. If you need a longer period to review our new releases, you should follow the major releases. Both strategies get patching releases with security fixes (high severity security fixes also result in ad-hoc patch releases). We’ll get into additional guidance on upgrade cadences later in this guide.

## How to find the specifics for a release

We love sharing all our great features with you so you can leverage Grafana to its fullest. We also understand that complete release documentation allows you to upgrade with confidence.
Whether it’s knowing that a bug has been fixed, seeing that a security vulnerability is patched, or understanding how to mitigate the impact of breaking changes, proper documentation allows you to make informed decisions about when to upgrade your local Grafana instances.

We provide release documentation in multiple places to address different needs:

- [**What’s new**](https://grafana.com/docs/grafana/latest/whatsnew/?pg=blog&plcmt=body-txt) outlines new features debuting in each major and minor release.
- [**Breaking changes**](https://grafana.com/docs/grafana/latest/breaking-changes/?pg=blog&plcmt=body-txt) notify you of updates included in major releases that could impact you and provide mitigation recommendations when needed.
- [**Upgrade guides**](https://grafana.com/docs/grafana/latest/upgrade-guide/?pg=blog&plcmt=body-txt) instruct you on how to upgrade to a newer minor or major version.
- And finally, a [**changelog**](https://github.com/grafana/grafana/blob/main/CHANGELOG.md) is generated for every release (major, minor, patching, security) and outlines all changes included in that release.

## When to expect releases

Currently, Grafana is on a monthly release cycle. Here’s a look at scheduled releases for 2025:

| **Release date** | **Grafana versions**      | **Release type** |
| ---------------- | ------------------------- | ---------------- |
| Jan. 28, 2025    | 11.5 & Supported versions | Minor & patching |
| Feb. 18, 2025    | Supported versions        | Patching         |
| March 25, 2025   | 11.6 & Supported versions | Minor & patching |
| April 23, 2025   | Supported versions        | Patching         |
| May 5, 2025      | Grafana 12.0              | Major only       |
| May 20, 2025     | Supported versions        | Patching         |
| June 17, 2025    | Supported versions        | Patching         |
| July 22, 2025    | 12.1 & Supported versions | Minor & patching |
| Aug. 12, 2025    | Supported versions        | Patching         |
| Sept. 23, 2025   | 12.2 & Supported versions | Minor & patching |
| Oct. 21, 2025    | Supported versions        | Patching         |
| Nov. 18, 2025    | 12.3 & Supported versions | Minor & patching |
| Dec. 16, 2025    | Supported versions        | Patching         |

### A few important notes

- The schedule above outlines how we plan release dates. However, unforeseen events and circumstances may cause dates to change.
- High severity security and feature degradation incidents will result in ad-hoc releases that are not scheduled ahead of time.
- Patching releases are for all supported minor versions of Grafana. Each supported minor version receives patch releases with bug fixes and security patches until its end of life.
- Release freezes: Each year Grafana implements two release freezes to accommodate for the holiday season. During these times, no scheduled releases will be executed. However, this does not apply to changes that may be required during the course of an operational or security incident.

## Grafana security releases: improved version naming convention

We've enhanced our naming convention for security release versions to make it easier to clearly identify our security releases from our standard patching releases.

In the past, critical vulnerabilities triggered unscheduled releases that incremented the patch version (e.g., 10.3.0 to 10.3.1). However, we found that the naming convention for these releases didn't clearly communicate the nature of the update. For example, if there was a version change from 11.3.0 to 11.3.1, there was no indication whether it was a security fix, a bug fix, or a minor feature update. This lack of clarity led to confusion about the urgency and nature of the update. <br>

{{< admonition type="note" >}}
Docker does not allow the plus sign (`+`) in image tag names. A plus sign (`+`) will be a rendered as a dash (`-`) in the docker tag.
{{< /admonition >}}

Our new approach directly addresses this issue. Going forward, security releases will be appended with "+security" to indicate that the release is the indicated version PLUS the security fix.

**For example**: A release named "11.2.3+security-01" would consist of what was released in 11.2.3 PLUS the indicated security fix. Once released, the security fix will also then be automatically included in all future releases of the impacted version.

This naming convention should make it easier to identify security updates and the Grafana version they're based on, allowing for a better understanding of the importance and urgency of each release.

## What to know about version support

Self-managed Grafana users have control over when they upgrade to a new version of Grafana. To help you make an informed decision about whether it’s time to upgrade, it’s important that you understand the level of support provided for your current version.

For self-managed Grafana (both Enterprise and OSS), the support for versions follows these rules:

- Each minor release is supported for 9 months after its release date
- The last minor release of a major version receives extended support for 15 months after its release date
- Support levels change as new versions are released:
  - **Full Support**: The current major version receives new features through new minor releases
  - **Patch Support**: Individual minor versions receive patch releases (bug fixes and security patches) until end of life
  - **Not Supported**: Versions beyond their support period receive no updates

Here is an overview of version support through 2026:

| **Version**               | **Release date**   | **Support end date** | **Support level**  |
| ------------------------- | ------------------ | -------------------- | ------------------ |
| 10.2.x                    | October 24, 2023   | July 24, 2024        | Not Supported      |
| 10.3.x                    | January 23, 2024   | October 23, 2024     | Not Supported      |
| 10.4.x (Last minor of 10) | March 5, 2024      | June 5, 2025         | Not Supported      |
| 11.0.x                    | May 14, 2024       | February 14, 2025    | Not Supported      |
| 11.1.x                    | June 25, 2024      | April 23, 2025       | Not Supported      |
| 11.2.x                    | August 27, 2024    | May 27, 2025         | Not Supported      |
| 11.3.x                    | October 22, 2024   | July 22, 2025        | Not Supported      |
| 11.4.x                    | December 5, 2024   | September 5, 2025    | Patch Support      |
| 11.5.x                    | January 28, 2025   | October 28, 2025     | Patch Support      |
| 11.6.x (Last minor of 11) | March 25, 2025     | June 25, 2026        | Patch Support      |
| 12.0.x                    | May 5, 2025        | February 5, 2026     | Patch Support      |
| 12.1.x                    | July 22, 2025      | April 22, 2026       | Patch Support      |
| 12.2.x                    | September 23, 2025 | June 23, 2026        | Yet to be released |
| 12.3.x                    | November 18, 2025  | August 18, 2026      | Yet to be released |

## How are these versions supported?

Self-managed Grafana follows semantic-like versioning (MAJOR.MINOR.PATCH). Here's how different types of releases work:

- **Major releases** (e.g., 12.5.8, 13.0.0):

  - Awesome new features as well as significant architectural improvements and modernizations
  - May include breaking changes that require migration steps
  - Released once per year

- **Minor releases** (e.g., 12.3.0, 12.4.0):

  - Contain new features and enhancements
  - Include bug fixes and security patches
  - Released every other month

- **Patch releases** (e.g., 12.3.1, 12.3.2):
  - **Only** contain bug fixes and security patches
  - **No new features** - these wait until the next minor release
  - Released monthly

**Support levels by version:**

- **Full Support** (current major version):

  - Gets new minor releases with new features approximately every other month
  - All minor versions within the major receive patch releases until end of life
  - Example: Major 12.x gets new features via 12.1.0, 12.2.0, 12.3.0, etc.

- **Patch Support** (individual minor versions):

  - Each minor version receives patch releases (bug fixes and security patches) until end of life
  - No new features - these only come with new minor releases
  - Example: 12.3.x gets 12.3.1, 12.3.2, etc. with fixes only

- **Not Supported**: Versions beyond their support period receive no updates and should be upgraded.

**Example**: When 12.3.0 is released, it includes new features. Subsequent releases like 12.3.1 and 12.3.2 only include bug fixes and security updates. All new features developed after 12.3.0 wait until 12.4.0 is released.

### What is a critical feature degradation?

A critical feature degradation usually meets one of the following criteria:

- Major functionality is universally unavailable (for example, cannot create dashboards, unable to authenticate).
- Major (critical) impact to a significant amount of customers.
- Major escalated incident for one or many customers.

## Self-managing upgrade strategies

Based on your needs, choose your ideal upgrade strategy. Here’s what that might look like in practice:

| **Strategy/cadence**                       | **Advantages/disadvantages**                                                                                                                                                                                                                                                                                           | **Example upgrade procedure**                                                                                                                                                                                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Minor / bi-monthly (11.1 to 11.2)**      | Our recommended strategy. It combines up-to-date, secure releases with access to latest features as soon as they're released. <ul><li>Small changelog to review</li><li>Highest compatibility with actively maintained plugins</li><li>Easy migration to [Grafana Cloud](https://grafana.com/products/cloud)</li></ul> | <ul><li>**January 2025**: You review the 11.5 changelog and deploy the release to testing</li><li>**February 2025**: You deploy 11.5 to production</li><li>**March 2025**: 11.6 is released</li></ul>                                                                       |
| **Major / yearly (10.0 to 11.0)**          | Yearly upgrade path that still gives access to up-to-date features presented at GrafanaCON.<ul><li>Big changelog to review</li><li>High compatibility with plugins</li><li>Relatively easy migration to [Grafana Cloud](https://grafana.com/products/cloud)</li></ul>                                                  | <ul><li>**May 2024**: 11.0 is released, you start a big changelog review</li><li>**June 2024**: You deploy 11.0 to testing</li><li>**July 2024**: You deploy 11.0 to production</li><li>**May 2025**: 12.0 is released</li></ul>                                            |
| **Previous major / yearly (10.4 to 11.6)** | Release with extended support timeline<ul><li>Limited compatibility with actively developed plugins</li><li>Big changelog to review</li><li>Migrations to Grafana Cloud might require professional support</li></ul>                                                                                                   | <ul><li>**May 2025**: 12.0 is released, marking the previous minor (11.6.x) with extended support, you start a big changelog review (10.4.x to 11.6.x)</li><li>**June 2025**: You deploy 11.6.x to testing</li><li>**July 2025**: You deploy 11.6.x to production</li></ul> |

Follow the “minor” strategy for the most flexibility, as you can also occasionally lengthen the cadence to a full quarter and still rely on your currently deployed minor release being supported with security fixes.

## How the Grafana team catches bugs and breaks during the release process

1. Each team writes automated tests for their code and we run [automated tests](https://github.com/grafana/grafana/blob/HEAD/contribute/developer-guide.md#test-grafana) which include unit tests, integration tests, end-to-end tests, and load tests. For plugins specifically, we test the frontend and backend parts of a data source (unit), integrating a data source with a matrix of Grafana versions (E2E), and the contract between the data source and the API it consumes (integration).
2. We perform manual acceptance and smoke testing internally for new features by deploying to our internal observability stack. After that, we progressively roll out in Grafana Cloud, and then cut an OSS and Enterprise release. Each stage catches bugs.
3. We ship new features in Experimental or Private Preview [release stages](https://grafana.com/docs/release-life-cycle/), behind feature toggles. This helps us improve the feature during development. If you are interested in gaining early access to features (including in your development or test environments), please let us know.
4. We scan Grafana, all plugins and their dependencies continuously for security vulnerabilities.

## Minimize the likelihood of bugs and problems during upgrade

Despite thorough testing, you can experience problems when upgrading:

### Bugs

Bugs are unexpected side effects of code changes in the release, which cause problems. Some bugs occur for all users, and we usually catch these in the early stages of testing. Others occur in a small number of Grafana instances with specific configuration or unusual use cases; for example a specific authentication setup or a combination of feature toggles. Grafana plugins also interact with external services via API to query data, and sometimes these APIs change without notice, causing issues for your dashboards that depend on these datasources. Grafana Labs has monitoring in place to regularly test these APIs, but at times they break in unexpected ways.

Reduce the risk of bugs by staying current and rolling out upgrades across dev or test environments before production. A Grafana Enterprise license entitles you to an additional dev and test instance for this purpose, available through your account team, and in Grafana Cloud you can create dev and test stacks that upgrade before production by using [rolling release channels](https://grafana.com/docs/rolling-release/).

- Back up your database on a regular basis, and especially before you upgrade.
- Roll back and report issues if you experience problems in dev or test.
- In Cloud, run a dev or test stack on the `fast` channel, and run your production stack on `steady` or `slow`. To change your release channel, open a support ticket.

### Known breaking changes

As a rule we always seek backward compatibility and migration, and reserve breaking changes for Grafana’s once-yearly major release. However occasionally small breaking changes (like updates to API payloads) will ship in minor releases. These are announced in [upgrade guides](https://grafana.com/docs/grafana/latest/upgrade-guide/), [What’s New](https://grafana.com/docs/grafana-cloud/whats-new/), and our [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md).

Always read the [upgrade guide](https://grafana.com/docs/grafana/latest/upgrade-guide/) and [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md) prior to upgrading to learn about and account for breaking changes.

### Plugin incompatibility

**Grafana core** ships as a single binary and consists of Dashboards, Alerts, Explore, Authentication and Authorization, Reporting, some core data sources, and other components. However, almost everyone who uses Grafana also uses **plugins**: panels, data sources, and applications that are released independently of Grafana. Every plugin version lists its Grafana version dependencies (you can see them at [https://grafana.com/grafana/plugins/](https://grafana.com/grafana/plugins/)) but different versions of different plugins can also interact with each other - for example you might visualize data from a data source in a panel in Grafana, all three of which are versioned independently of each other. That can create issues that are hard to catch in testing.

To minimize the likelihood of plugin incompatibility issues, run the latest available version of plugins and update them regularly. Always [update plugins](https://grafana.com/docs/grafana/latest/administration/plugin-management/#update-a-plugin) before updating Grafana. Plugins also follow Semver patterns, so review the plugin’s changelog for breaking changes before upgrading to a new major version of that plugin.
