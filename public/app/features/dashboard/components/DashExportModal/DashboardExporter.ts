import _ from 'lodash';

import config from 'app/core/config';
import { DashboardModel } from '../../state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state';
import { PanelPluginMeta } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

interface Input {
  name: string;
  type: string;
  label: string;
  value: any;
  description: string;
}

interface Requires {
  [key: string]: {
    type: string;
    id: string;
    name: string;
    version: string;
  };
}

interface DataSources {
  [key: string]: {
    name: string;
    label: string;
    description: string;
    type: string;
    pluginId: string;
    pluginName: string;
  };
}

export class DashboardExporter {
  makeExportable(dashboard: DashboardModel) {
    // clean up repeated rows and panels,
    // this is done on the live real dashboard instance, not on a clone
    // so we need to undo this
    // this is pretty hacky and needs to be changed
    dashboard.cleanUpRepeats();

    const saveModel = dashboard.getSaveModelClone();
    saveModel.id = null;

    // undo repeat cleanup
    dashboard.processRepeats();

    const inputs: Input[] = [];
    const requires: Requires = {};
    const datasources: DataSources = {};
    const promises: Array<Promise<void>> = [];
    const variableLookup: { [key: string]: any } = {};

    for (const variable of saveModel.getVariables()) {
      variableLookup[variable.name] = variable;
    }

    const templateizeDatasourceUsage = (obj: any) => {
      let datasource: string = obj.datasource;
      let datasourceVariable: any = null;

      // ignore data source properties that contain a variable
      if (datasource && datasource.indexOf('$') === 0) {
        datasourceVariable = variableLookup[datasource.substring(1)];
        if (datasourceVariable && datasourceVariable.current) {
          datasource = datasourceVariable.current.value;
        }
      }

      promises.push(
        getDataSourceSrv()
          .get(datasource)
          .then(ds => {
            if (ds.meta?.builtIn) {
              return;
            }

            // add data source type to require list
            requires['datasource' + ds.meta?.id] = {
              type: 'datasource',
              id: ds.meta?.id,
              name: ds.meta?.name,
              version: ds.meta?.info.version || '1.0.0',
            };

            // if used via variable we can skip templatizing usage
            if (datasourceVariable) {
              return;
            }

            const refName = 'DS_' + ds.name.replace(' ', '_').toUpperCase();
            datasources[refName] = {
              name: refName,
              label: ds.name,
              description: '',
              type: 'datasource',
              pluginId: ds.meta?.id,
              pluginName: ds.meta?.name,
            };

            obj.datasource = '${' + refName + '}';
          })
      );
    };

    const processPanel = (panel: PanelModel) => {
      if (panel.datasource !== undefined) {
        templateizeDatasourceUsage(panel);
      }

      if (panel.targets) {
        for (const target of panel.targets) {
          if (target.datasource !== undefined) {
            templateizeDatasourceUsage(target);
          }
        }
      }

      const panelDef: PanelPluginMeta = config.panels[panel.type];
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
    for (const panel of saveModel.panels) {
      processPanel(panel);

      // handle collapsed rows
      if (panel.collapsed !== undefined && panel.collapsed === true && panel.panels) {
        for (const rowPanel of panel.panels) {
          processPanel(rowPanel);
        }
      }
    }

    // templatize template vars
    for (const variable of saveModel.getVariables()) {
      if (variable.type === 'query') {
        templateizeDatasourceUsage(variable);
        variable.options = [];
        variable.current = {};
        variable.refresh = variable.refresh > 0 ? variable.refresh : 1;
      }
    }

    // templatize annotations vars
    for (const annotationDef of saveModel.annotations.list) {
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
        _.each(datasources, (value: any) => {
          inputs.push(value);
        });

        // templatize constants
        for (const variable of saveModel.getVariables()) {
          if (variable.type === 'constant') {
            const refName = 'VAR_' + variable.name.replace(' ', '_').toUpperCase();
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
        const newObj: { [key: string]: {} } = {};
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
