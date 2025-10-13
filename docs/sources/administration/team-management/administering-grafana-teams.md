---
description: Learn how to administer Grafana Teams.
labels:
  products:
    - enterprise
    - oss
    - cloud
keywords:
  - authorization
  - microservices
  - architecture
menuTitle: Administer Grafana Teams
title: Administer Grafana Teams
weight: 300
---

# Administer Grafana Teams

This topic describes how to administer Grafana Teams.

## View a list of Teams

See the complete list of teams in your Grafana organization.

To view a list of teams:

1. Sign in to Grafana as an organization administrator or a team administrator.
1. Click the arrow next to **Administration** in the left-side menu, click **Users and access**, and select **Teams**.

The role you use to sign in to Grafana determines how you see Teams lists.

### Organization administrator view

The following example shows a list as it appears to an `organization` administrator.

![Team list view for org admin](/media/docs/grafana/screenshot-org-admin-team-list.png)

### Team administrator view

The following example shows a list as it appears to a `team` administrator.

![Team list view for team admin](/media/docs/grafana/screenshot-team-admin-team-list.png)

## Teams best practices

Grafana recommends you use Teams to organize and manage access to Grafana’s core resources, such as dashboards and alerts. Teams is an easy organizational tool to manage, and allows flexible sharing between teams.

Grafana recommends that you use Instances or Stacks to separate Teams if you want true isolation, to ensure that no information leaks between Teams. You can synchronize some resources between instances using provisioning.

## Secure Grafana Teams

The most important thing to consider for securing Teams is to only grant team administrator rights to the users you trust to administer the Team.
