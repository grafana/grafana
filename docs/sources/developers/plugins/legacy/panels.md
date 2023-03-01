---
aliases:
  - ../../../plugins/developing/panels/
keywords:
  - grafana
  - plugins
  - panel
  - documentation
title: Legacy panel plugins
---

# Legacy panel plugins

Panels are the main building blocks of dashboards.

## Panel development

### Scrolling

The grafana dashboard framework controls the panel height. To enable a scrollbar within the panel the PanelCtrl needs to set the scrollable static variable:

```javascript
export class MyPanelCtrl extends PanelCtrl {
  static scrollable = true;
  ...
```

In this case, make sure the template has a single `<div>...</div>` root. The plugin loader will modify that element adding a scrollbar.

### Examples

- [clock-panel](https://github.com/grafana/clock-panel)
- [singlestat-panel](https://github.com/grafana/grafana/tree/main/public/app/plugins/panel/singlestat)
