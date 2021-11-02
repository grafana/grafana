import { makeClassES5Compatible } from '@grafana/data';
import { loadPluginCss } from '@grafana/runtime';
import { PanelCtrl as PanelCtrlES6 } from 'app/angular/panel/panel_ctrl';
import { MetricsPanelCtrl as MetricsPanelCtrlES6 } from 'app/angular/panel/metrics_panel_ctrl';
import { QueryCtrl as QueryCtrlES6 } from 'app/angular/panel/query_ctrl';
var PanelCtrl = makeClassES5Compatible(PanelCtrlES6);
var MetricsPanelCtrl = makeClassES5Compatible(MetricsPanelCtrlES6);
var QueryCtrl = makeClassES5Compatible(QueryCtrlES6);
export { PanelCtrl, MetricsPanelCtrl, QueryCtrl, loadPluginCss };
//# sourceMappingURL=sdk.js.map