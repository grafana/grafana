---
aliases:
  - ../configure-alertmanager/
description: Configure Alertmanager
keywords:
  - grafana
  - alerting
  - set up
  - configure
  - Alertmanager
title: Configure Alertmanager
weight: 100
---

# Configure Alertmanager

Configure Alertmanager from Grafana Alerting to group and manage alert rules, adding a layer of orchestration on top of your external alerting engine.

## Add a new external Alertmanager

1. In the Grafana menu, click the Alerting (bell) icon to open the Alerting page listing existing alerts.
2. Click **Admin** and then scroll down to the External Alertmanager section.
3. Click **Add Alertmanager** and a modal opens.
4. Add the URL and the port for the external Alertmanager. You do not need to specify the path suffix, for example, `/api/v(1|2)/alerts`. Grafana automatically adds this.

The external URL is listed in the table with a pending status. Once Grafana verifies that the Alertmanager is discovered, the status changes to active. No requests are made to the external Alertmanager at this point; the verification signals that alerts are ready to be sent.

### Edit an external Alertmanager

1. Click the pen symbol to the right of the Alertmanager row in the table.
2. When the edit modal opens, you can view all the URLs that were added.

The edited URL will be pending until Grafana verifies it again.

{{< figure max-width="40%" src="/static/img/docs/alerting/unified/ext-alertmanager-active.png" max-width="650px" caption="External Alertmanagers" >}}
