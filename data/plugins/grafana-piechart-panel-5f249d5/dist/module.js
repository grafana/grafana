'use strict';

System.register(['./piechart_ctrl', 'app/plugins/sdk'], function (_export, _context) {
  "use strict";

  var PieChartCtrl, loadPluginCss;
  return {
    setters: [function (_piechart_ctrl) {
      PieChartCtrl = _piechart_ctrl.PieChartCtrl;
    }, function (_appPluginsSdk) {
      loadPluginCss = _appPluginsSdk.loadPluginCss;
    }],
    execute: function () {

      loadPluginCss({
        dark: 'plugins/grafana-piechart-panel/css/piechart.dark.css',
        light: 'plugins/grafana-piechart-panel/css/piechart.light.css'
      });

      _export('PanelCtrl', PieChartCtrl);
    }
  };
});
//# sourceMappingURL=module.js.map
