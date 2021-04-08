import { makeClassES5Compatible } from '@grafana/data';
import { loadPluginCss } from '@grafana/runtime';
import { PanelCtrl as PanelCtrlES6 } from 'app/features/panel/panel_ctrl';
import { MetricsPanelCtrl as MetricsPanelCtrlES6 } from 'app/features/panel/metrics_panel_ctrl';
import { QueryCtrl as QueryCtrlES6 } from 'app/features/panel/query_ctrl';
import { alertTab } from 'app/features/alerting/AlertTabCtrl';

const PanelCtrl = makeClassES5Compatible(PanelCtrlES6);
const MetricsPanelCtrl = makeClassES5Compatible(MetricsPanelCtrlES6);
const QueryCtrl = makeClassES5Compatible(QueryCtrlES6);

export { PanelCtrl, MetricsPanelCtrl, QueryCtrl, alertTab, loadPluginCss };
