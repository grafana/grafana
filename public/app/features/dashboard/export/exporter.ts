///<reference path="../../../headers/common.d.ts" />

import config from 'app/core/config';
import angular from 'angular';
import _ from 'lodash';

import {DynamicDashboardSrv} from '../dynamic_dashboard_srv';

export class DashboardExporter {

  constructor(private datasourceSrv) {
  }

  makeExportable(dash) {
    var dynSrv = new DynamicDashboardSrv();
    dynSrv.process(dash, {cleanUpOnly: true});

    dash.id = null;

    var inputs = [];
    var requires = {};
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
              pluginName: ds.meta.name,
            };
            panel.datasource = '${' + refName  +'}';

            requires['datasource' + ds.meta.id] = {
              type: 'datasource',
              id: ds.meta.id,
              name: ds.meta.name,
              version: ds.meta.info.version || "1.0.0",
            };
          }));
        }

        var panelDef = config.panels[panel.type];
        if (panelDef) {
          requires['panel' + panelDef.id] = {
            type: 'panel',
            id: panelDef.id,
            name: panelDef.name,
            version: panelDef.info.version,
          };
        }
      });
    }

    return Promise.all(promises).then(() => {
      _.each(datasources, (value, key) => {
        inputs.push(value);
      });

      requires = _.map(requires, req =>  {
        return req;
      });

      // make inputs and requires a top thing
      var newObj = {};
      newObj["__inputs"] = inputs;
      newObj["__requires"] = requires;

      _.defaults(newObj, dash);

      return newObj;
    }).catch(err => {
      console.log('Export failed:', err);
      return {};
    });
  }

  export(dashboard) {
    return this.makeExportable(dashboard).then(clean => {
      var html = angular.toJson(clean, true);
      var uri = "data:application/json," + encodeURIComponent(html);
      var newWindow = window.open(uri);

      // var blob = new Blob([angular.toJson(clean, true)], { type: "application/json;charset=utf-8" });
      // var wnd: any = window;
      // wnd.saveAs(blob, clean.title + '-' + new Date().getTime() + '.json');
    });
  }

}

