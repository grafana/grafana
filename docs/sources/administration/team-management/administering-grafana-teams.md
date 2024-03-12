---
aliases:
  - 
description: Learn more about Grafana Mimir’s microservices-based architecture.
labels:
  products:
    - enterprise
    - oss
    - cloud
keywords:
  - authorization
  - microservices
  - architecture
menuTitle: Administering Grafana Teams
title: Administering Grafana Teams
weight: 300
---

# Administering Grafana Teams

This topic describes how to administer Grafana Teams.

## View a list of Teams

See the complete list of teams in your Grafana organization.

To view a list of teams:

- Sign in to Grafana as an organization administrator or a team administrator.

1. Click the arrow next to **Administration** in the left-side menu, click **Users and access**, and select **Teams**. 
1. The role you use to sign in to Grafana determines how you see Teams lists. 

### Organization administrator view

The following example shows a list as it appears to an organization administrator.

### Team administrator view

The following example shows a list as it appears to a team administrator.
 

## Teams best practices

Grafana recommends you use Teams to organize and manage access to Grafana’s core resources, such as dashboards and alerts. Teams is an easy organizational tool to manage, and allows flexible sharing between teams.  

Grafana recommends that you use Instances or Stacks to separate Teams if you want true isolation — to make sure that no information leaks between teams. You can synchronize some resources between instances using provisioning.

