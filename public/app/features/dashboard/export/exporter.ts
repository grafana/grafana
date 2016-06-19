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

    var templateizeDatasourceUsage = obj => {
      promises.push(this.datasourceSrv.get(obj.datasource).then(ds => {
        var refName = 'DS_' + ds.name.replace(' ', '_').toUpperCase();
        datasources[refName] = {
          name: refName,
          label: ds.name,
          description: '',
          type: 'datasource',
          pluginId: ds.meta.id,
          pluginName: ds.meta.name,
        };
        obj.datasource = '${' + refName  +'}';

        requires['datasource' + ds.meta.id] = {
          type: 'datasource',
          id: ds.meta.id,
          name: ds.meta.name,
          version: ds.meta.info.version || "1.0.0",
        };
      }));
    };

    // check up panel data sources
    for (let row of dash.rows) {
      _.each(row.panels, (panel) => {
        if (panel.datasource !== undefined) {
          templateizeDatasourceUsage(panel);
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

    // templatize template vars
    for (let variable of dash.templating.list) {
      if (variable.type === 'query') {
        templateizeDatasourceUsage(variable);
        variable.options = [];
        variable.current = {};
        variable.refresh = 1;
      }
    }

    // templatize annotations vars
    for (let annotationDef of dash.annotations.list) {
      templateizeDatasourceUsage(annotationDef);
    }

    // add grafana version
    requires['grafana'] = {
      type: 'grafana',
      id: 'grafana',
      name: 'Grafana',
      version: config.buildInfo.version
    };

    return Promise.all(promises).then(() => {
      _.each(datasources, (value, key) => {
        inputs.push(value);
      });

      // templatize constants
      for (let variable of dash.templating.list) {
        if (variable.type === 'constant') {
          var refName = 'VAR_' + variable.name.replace(' ', '_').toUpperCase();
          inputs.push({
            name: refName,
            type: 'constant',
            label: variable.label || variable.name,
            value: variable.current.value,
            description: '',
          });
          // update current and option
          variable.query = '${' + refName + '}';
          variable.options[0] = variable.current = {
            value: variable.query,
            text: variable.query,
          };
        }
      }

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
      return {
        error: err
      };
    });
  }

}

