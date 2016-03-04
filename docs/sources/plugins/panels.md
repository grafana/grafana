---
page_title: Plugin panel
page_description: Panel plugins for Grafana
page_keywords: grafana, plugins, documentation
---

 > Our goal is not to have a very extensive documentation but rather have actual code that people can look at. An example implementation of a datasource can be found in the grafana repo under /examples/panel-boilerplate-es5

# Panels

To interact with the rest of grafana the panel plugin need to export a class in the module.js.
This class have to inherit from sdk.PanelCtrl or sdk.MetricsPanelCtrl and be exported as PanelCtrl.

```javascript
  return {
    PanelCtrl: BoilerPlatePanelCtrl
  };
```

This class will be instancieted once for every panel of its kind in a dashboard and treated as an AngularJs controller.

## MetricsPanelCtrl or PanelCtrl

MetricsPanelCtrl inherits from PanelCtrl and adds some common features for datasource usage. So if your Panel will be working with a datasource you should inherit from MetricsPanelCtrl. If dont need to access any datasource then you should inherit from PanelCtrl instead.

## Implementing a MetricsPanelCtrl

If you choose to inherit from MetricsPanelCtrl you should implement a function called refreshData that will take an datasource as inparameter when its time to get new data. Its recommended that the refreshData function calls the issueQueries in the base class but its not mandatory. An examples of such implementation can be found in our [example panel](https://github.com/grafana/grafana/blob/master/examples/panel-boilerplate-es5/module.js#L27-L38)

