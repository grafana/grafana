import config from 'app/core/config';
import _ from 'lodash';
import { DashboardModel } from '../dashboard_model';

export class DashboardExporter {
  constructor(private datasourceSrv) {}

  makeExportable(dashboard: DashboardModel) {
    // clean up repeated rows and panels,
    // this is done on the live real dashboard instance, not on a clone
    // so we need to undo this
    // this is pretty hacky and needs to be changed
    dashboard.cleanUpRepeats();

    var saveModel = dashboard.getSaveModelClone();
    saveModel.id = null;

    // undo repeat cleanup
    dashboard.processRepeats();

    var inputs = [];
    var requires = {};
    var datasources = {};
    var promises = [];
    var variableLookup: any = {};

    for (let variable of saveModel.templating.list) {
      variableLookup[variable.name] = variable;
    }

    var templateizeDatasourceUsage = obj => {
      // ignore data source properties that contain a variable
      if (obj.datasource && obj.datasource.indexOf('$') === 0) {
        if (variableLookup[obj.datasource.substring(1)]) {
          return;
        }
      }

      promises.push(
        this.datasourceSrv.get(obj.datasource).then(ds => {
          if (ds.meta.builtIn) {
            return;
          }

          var refName = 'DS_' + ds.name.replace(' ', '_').toUpperCase();
          datasources[refName] = {
            name: refName,
            label: ds.name,
            description: '',
            type: 'datasource',
            pluginId: ds.meta.id,
            pluginName: ds.meta.name,
          };
          obj.datasource = '${' + refName + '}';

          requires['datasource' + ds.meta.id] = {
            type: 'datasource',
            id: ds.meta.id,
            name: ds.meta.name,
            version: ds.meta.info.version || '1.0.0',
          };
        })
      );
    };

    const processPanel = panel => {
      if (panel.datasource !== undefined) {
        templateizeDatasourceUsage(panel);
      }

      if (panel.targets) {
        for (let target of panel.targets) {
          if (target.datasource !== undefined) {
            templateizeDatasourceUsage(target);
          }
        }
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
    };

    // check up panel data sources
    for (let panel of saveModel.panels) {
      processPanel(panel);

      // handle collapsed rows
      if (panel.collapsed !== undefined && panel.collapsed === true && panel.panels) {
        for (let rowPanel of panel.panels) {
          processPanel(rowPanel);
        }
      }
    }

    // templatize template vars
    for (let variable of saveModel.templating.list) {
      if (variable.type === 'query') {
        templateizeDatasourceUsage(variable);
        variable.options = [];
        variable.current = {};
        variable.refresh = variable.refresh > 0 ? variable.refresh : 1;
      }
    }

    // templatize annotations vars
    for (let annotationDef of saveModel.annotations.list) {
      templateizeDatasourceUsage(annotationDef);
    }

    // add grafana version
    requires['grafana'] = {
      type: 'grafana',
      id: 'grafana',
      name: 'Grafana',
      version: config.buildInfo.version,
    };

    return Promise.all(promises)
      .then(() => {
        _.each(datasources, (value, key) => {
          inputs.push(value);
        });

        // templatize constants
        for (let variable of saveModel.templating.list) {
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

        // make inputs and requires a top thing
        var newObj = {};
        newObj['__inputs'] = inputs;
        newObj['__requires'] = _.sortBy(requires, ['id']);

        _.defaults(newObj, saveModel);
        return newObj;
      })
      .catch(err => {
        console.log('Export failed:', err);
        return {
          error: err,
        };
      });
  }
}
