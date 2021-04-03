import { PanelCtrl } from 'app/features/panel/panel_ctrl';
import { MetricsPanelCtrl as MetricsPanelCtrlES6 } from 'app/features/panel/metrics_panel_ctrl';
import { QueryCtrl } from 'app/features/panel/query_ctrl';
import { alertTab } from 'app/features/alerting/AlertTabCtrl';
import { loadPluginCss } from '@grafana/runtime';

const MetricsPanelCtrl = new Proxy(MetricsPanelCtrlES6, {
  // ES5 code will call it like a function using super
  apply(target, self, argumentsList) {
    if (typeof Reflect === 'undefined' || !Reflect.construct) {
      alert('Browser is too old');
    }

    return Reflect.construct(target, argumentsList, self.constructor);
  },
});

export { PanelCtrl, MetricsPanelCtrl, QueryCtrl, alertTab, loadPluginCss };
