+++
title = "Notification policies"
description = "Notification policies"
keywords = ["grafana", "alerting", "guide", "notification policies", "routes"]
weight = 400
+++

## Notification policies

Notification policies determine how alerts are routed to contact points. Policies have a tree structure, where each policy can have one or more child policies. Each policy except for the root policy can also match specific alert labels. Each alert enters policy tree at the root and then traverses each child polciy. If `Continue matching subsequent sibling nodes` is not checked, it stops at the first matching node, otherwise, it continues matching it's siblings as well. If an alert does not match any children of a policy, the alert is handled based on the configuration settings of this policy and notified to the contact point configured on this policy. Alert that does not match any specific policy is handled by the root policy.

Grafana alerting UI allows you to configrue Grafana notification policies as well as notification policies (routes) for an [external Alertmanager if one is configured]({{< relref "../../datasources/alertmanager.md" >}}).


## Edit notification policies

To access notification policy editing page, In the Grafana side bar, hover your cursor over the **Alerting (bell)** icon and then click **Notification policies**.

### Edit root notification policy

1. Click **edit** button on the top right of the root policy box.
1. Make changes and click **save** button. 

### Edit specific policies

