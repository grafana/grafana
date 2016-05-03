///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import angular from 'angular';
import _ from 'lodash';

import {DynamicDashboardSrv} from './dynamic_dashboard_srv';

export class DashboardExporter {

  constructor(private datasourceSrv) {
  }

  makeExportable(dash) {
    var dynSrv = new DynamicDashboardSrv();
    dynSrv.process(dash, {cleanUpOnly: true});

    var inputs = [];
    var datasources = {};
    var promises = [];

    for (let row of dash.rows) {
      _.each(row.panels, (panel) => {
        if (panel.datasource !== undefined) {
          promises.push(this.datasourceSrv.get(panel.datasource).then(ds => {
            var refName = 'DS_' + ds.name.toUpperCase();
            datasources[panel.datasource] = {
              name: refName,
              type: 'datasource',
              pluginId: ds.meta.id,
            };
            panel.datasource = '${' + refName  +'}';
          }));
        }
      });
    }

    return Promise.all(promises).then(() => {
      _.each(datasources, (value, key) => {
        inputs.push(value);
      });

      dash["__inputs"] = inputs;
      return dash;
    });
  }

  export(dashboard) {
    return this.makeExportable(dashboard).then(clean => {
      var blob = new Blob([angular.toJson(clean, true)], { type: "application/json;charset=utf-8" });
      var wnd: any = window;
      wnd.saveAs(blob, clean.title + '-' + new Date().getTime() + '.json');
    });
  }

}

