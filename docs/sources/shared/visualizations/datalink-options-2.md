---
title: Data links and actions options
comments: |
  There are four data link shared files, datalink-options.md, datalink-options-1.md, datalink-options-2.md, and datalink-options-3.md to cover the most common combinations of options. 
  Using shared files ensures that content remains consistent across visualizations that share the same options and users don't have to figure out which options apply to a specific visualization when reading that content.
  This file is used in the following visualizations: bar chart, candlestick, state timeline, status history, time series, trend, xy chart
---

_Data links_ allow you to link to other panels, dashboards, and external resources and _actions_ let you trigger basic, unauthenticated, API calls.
In both cases, you can carry out these tasks while maintaining the context of the source panel.

For each data link, set the following options:

- **Title**
- **URL**
- **Open in new tab**
- **One click** - Opens the data link with a single click. Only one data link can have **One click** enabled at a time.

For each action, define the following API call settings:

<!-- prettier-ignore-start -->

| Option               | Description                                                       |
| -------------------- | ----------------------------------------------------------------- |
| Title                | A human-readable label for the action that's displayed in the UI. |
| Confirmation message | A descriptive prompt to confirm or cancel the action. |
| Method               | Select from **POST**, **PUT**, or **GET**. |
| URL                  | The request URL.</p><p>To add a variable, click in the **URL** field and enter `$` or press Ctrl+Space or Cmd+Space to see a list of available variables. |
| Variables            | **Key** and **Name** pairs with a type selection. Click the **+** icon to add as many variables as you need. To add a variable to the request, prefix the key with `$`. You can set the values for the variables when performing an action. |
| Query parameters     | **Key** and **Value** pairs. Click the **+** icon to add as many key/value pairs as you need. |
| Headers              | Comprised of **Key** and **Value** pairs and a **Content-Type**.</p><p>Click the **+** icon to add as many key/value pairs as you need. |
| Content-Type         | Select from the following: **application/json**, **text/plain**, **application/XML**, and **application/x-www-form-urlencoded**. |
| Body                 | The body of the request. |

<!-- prettier-ignore-end -->

To learn more, refer to [Configure data links and actions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-data-links/).
