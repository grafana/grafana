import { PieChartCtrl } from './piechart_ctrl';
import { loadPluginCss } from 'app/plugins/sdk';

loadPluginCss({
  dark: 'plugins/grafana-piechart-panel/css/piechart.dark.css',
  light: 'plugins/grafana-piechart-panel/css/piechart.light.css',
});

export { PieChartCtrl as PanelCtrl };
