---
description: Strategies for updating your self-hosted Grafana instance
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
title: Strategies for updating your self-hosted Grafana instance
menuTitle: Strategies for updating your self-hosted Grafana instance
weight: 1000
---
# Upgrade with confidence: strategies for updating your self-hosted Grafana instance

At Grafana Labs we believe in shipping features early and often, and in recent years we’ve doubled down on that philosophy.

We no longer wait for the yearly major release to give you access to the next big thing. Instead, we regularly make new features, bug fixes, and security patches available to our self-managing users ([Grafana OSS](https://grafana.com/oss/grafana/) and Grafana Enterprise) throughout the year.

Having a dependable release process provides users like you with the best Grafana experience possible, and it provides the flexibility to upgrade in a manner that works best for you and your organization. In this blog post, we want to update you on our current approach to releases and the cadence we plan to follow for the remainder of 2024 and beyond.

## What to expect from each release type

We split Grafana OSS and Grafana Enterprise releases into three main categories:

- **Minor release (every other month)**: These releases can include new features, deprecation notices, notices about upcoming breaking changes, previously announced breaking changes, bug fixes, and security vulnerability patches
- **Major release (once a year, in April/May)**: Like a minor release but accompanied by [GrafanaCON](https://grafana.com/events/grafanacon/) and a comprehensive upgrade guide for users who like to upgrade only once a year
- **Patching release (every month)**: These include bug fixes for currently supported versions, as well as any security vulnerability patches

You can choose your cadence: For frequent self-managed updates, you should follow the minor release (for example, upgrade 10.1 to 10.2), which also gives you access to the latest features. If you need a longer period to review our new releases, you should follow the major releases. Both strategies will get patching releases with security fixes (high severity security fixes will also result in ad-hoc patch releases). We’ll get into additional guidance on upgrade cadences later in this guide.

## How to find the specifics for a release

We love sharing all our great features with you so you can leverage Grafana to its fullest! We also understand that great release documentation allows you to upgrade with confidence. Whether it’s knowing that a pesky bug has been fixed, seeing that a security vulnerability is patched, or understanding how to mitigate the impact of breaking changes, proper documentation allows you to make informed decisions about when to upgrade your local Grafana instances.

We provide release documentation in multiple places to address different needs:

- [**What’s new**](https://grafana.com/docs/grafana/latest/whatsnew/?pg=blog&plcmt=body-txt) outlines new features debuting in each major and minor release.
- [**Breaking changes**](https://grafana.com/docs/grafana/latest/breaking-changes/?pg=blog&plcmt=body-txt) notify you of updates included in major releases that could impact you and provide mitigation recommendations when needed.
- [**Upgrade guides**](https://grafana.com/docs/grafana/latest/upgrade-guide/?pg=blog&plcmt=body-txt) instruct you on how to upgrade to a newer minor or major version.
- And finally, a [**changelog**](https://github.com/grafana/grafana/blob/main/CHANGELOG.md) is generated for every release (major, minor, patching, security) and outlines all changes included in that release.

So now that you know what is included in our release types, we can talk about…

## When to expect releases

Currently, Grafana is on a monthly release cycle, with release types rotating every other month between minor or patching. For example, here’s a look at what scheduled releases to expect for the remainder of 2024:

| **Anticipated release date** | **Grafana version(s)** | **Release type**          |
|------------------------------|------------------------|---------------------------|
| May 14, 2024                 | 11                     | Major & patching           |
| June 25, 2024                | 11.1                   | Minor & patching           |
| July 23, 2024                | 11.1.x                 | Patching                   |
| Aug. 27, 2024                | 11.2                   | Minor & patching           |
| Sept. 24, 2024               | 11.2.x                 | Patching                   |
| Oct. 22, 2024                | 11.3                   | Minor & patching           |
| November/December 2024       | TBD                    | TBD                        |

### A few important notes

- The schedule above is an outline of release dates. However, unforeseen events and circumstances may cause dates to change.
- High severity security and feature degradation incidents will result in ad-hoc releases that are not scheduled ahead of time.
- Patching releases are for the current (last released) minor version of Grafana. Additional older versions of Grafana may be included if there is a critical bug or security vulnerability that needs to be patched.
- A Grafana release freeze occurs for a week in November and again during the end of December. This does not apply to changes that may be required during the course of an operational or security incident.

## What to know about version support

Self-managed Grafana users have control over when they upgrade to a new version of Grafana. To help you make an informed decision of whether it is time to upgrade, it’s important that you understand the level of support provided for your current version.

For self-managed Grafana (both Enterprise and OSS), the support for versions is as follows:

- Support for each minor release extends to nine months after their release date.
- Support for the last minor release of a major version is extended an additional six months, for a total of 15 months of support after the release date.

Here is an overview of projected version support through 2024:

| **Version**  | **Release date** | **Support end of life (EOL)** |
|--------------|------------------|-------------------------------|
| 10.3         | January 2024      | October 2024                  |
| 10.4 (Last minor of 10.0) | March 2024 | June 2025 (extended support)  |
| 11.0         | May 2024         | February 2025                 |
| 11.1         | June 2024        | March 2025                    |
| 11.2         | August 2024 (tentative) | May 2025 (tentative)       |

**Note:** Grafana 9.5.x was the last supported minor for the 9.0 major release and is no longer supported as of July 2024.

## How are these versions supported?

The level of support changes as new versions of Grafana are released. Here are a few details to keep in mind:

- The current (most recently released) version of Grafana gets the highest level of support. Releases for this version include all the fantastic new features along with all bug fixes.
- All supported versions receive security patches for vulnerabilities impacting that version.
- All supported versions receive patches for bugs that cause critical feature degradation incidents.

Keeping all this in mind, users that want to receive the most recent features and all bug fixes should be on the current (most recently released) version of Grafana.

### What is a critical feature degradation?

A critical feature degradation usually meets one of the following criteria:

- Major functionality is universally unavailable (for example, cannot create dashboards, unable to authenticate).
- Major (showstopping) impact to a significant amount of customers.
- Major escalated incident for one or many customers.

## Self-managing upgrade strategies

Based on your needs, you can choose your ideal upgrade strategy. Here’s what that might look like in practice:

| **Strategy / cadence**   | **Advantages / disadvantages**                                    | **Example upgrade procedure** |
|--------------------------|-------------------------------------------------------------------|--------------------------------|
| **Minor / bi-monthly (11.1 to 11.2)** | Our recommended strategy. It combines up-to-date, secure releases with access to latest features as soon as they get released.<br> - Small changelog to review<br> - Highest compatibility with actively maintained plugins<br> - Easy migration to [Grafana Cloud](https://grafana.com/products/cloud) | **June 2024**: You review the 11.1 changelog and deploy the release to testing<br> **July 2024**: You deploy 11.1 to production<br> **August 2024**: 11.2 is released |
| **Major / yearly (10.0 to 11.0)** | Yearly upgrade path that still gives access to up-to-date features presented at GrafanaCON.<br> - Big changelog to review<br> - High compatibility with plugins<br> - Relatively easy migration to [Grafana Cloud](https://grafana.com/products/cloud) | **April 2024**: 11.0 is released, you start a big changelog review<br> **May 2024**: You deploy 11.0 to testing<br> **June 2024**: You deploy 11.0 to production<br> April 2025: 12.0 is released |
| **Previous major / yearly (9.5 to 10.4)** | Release with extended support timeline<br> - Limited compatibility with actively developed plugins<br> - Big changelog to review<br> - Migrations to Grafana Cloud might require professional support | **April 2024**: 11.0 is released, marking the previous minor (10.4.x) with extended support, you start a big changelog review (9.5.x to 10.4.x)<br> **May 2024**: You deploy 10.4.x to testing<br> **June 2024**: You deploy 10.4.x to production |

For each strategy, the operator has to keep an eye out for patch releases that will fix security vulnerabilities (released monthly, plus ad-hoc releases). Follow the “minor” strategy for the most flexibility, as you can also occasionally lengthen the cadence to a full quarter and still rely on your currently deployed minor release being supported with security fixes.

We hope you find this information useful and that it allows you to smooth out your Grafana update flow and take advantage of the latest features, fixes, and security updates as soon as they are available. Information on the Grafana self-managing release schedule and supported versions will be updated at the beginning of each year to guide customers in their update planning.
