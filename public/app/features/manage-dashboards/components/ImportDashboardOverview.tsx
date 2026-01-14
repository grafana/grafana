import { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { DataSourceInstanceSettings, dateTimeFormat, locationUtil, TypedVariableModel } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { locationService, reportInteraction, config } from '@grafana/runtime';
import { Panel } from '@grafana/schema/dist/esm/raw/dashboard/x/dashboard_types.gen';
import { AnnotationQuery, Dashboard } from '@grafana/schema/dist/esm/veneer/dashboard.types';
import { Box, Legend, TextLink } from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { addLibraryPanel } from 'app/features/library-panels/state/api';
import { StoreState } from 'app/types/store';

import { clearLoadedDashboard, importDashboard } from '../state/actions';
import { DashboardSource, DataSourceInput, ImportDashboardDTO, LibraryPanelInputState } from '../state/reducers';

import { ImportDashboardForm } from './ImportDashboardForm';

const IMPORT_FINISHED_EVENT_NAME = 'dashboard_import_imported';

const mapStateToProps = (state: StoreState) => {
  const searchObj = locationService.getSearchObject();

  return {
    dashboard: state.importDashboard.dashboard,
    meta: state.importDashboard.meta,
    source: state.importDashboard.source,
    inputs: state.importDashboard.inputs,
    folder: searchObj.folderUid ? { uid: String(searchObj.folderUid) } : { uid: '' },
  };
};

const mapDispatchToProps = {
  clearLoadedDashboard,
  importDashboard,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = ConnectedProps<typeof connector>;

interface State {
  uidReset: boolean;
}

// disabling this rule, eventually we will migrate to function components and also stop using redux
// eslint-disable-next-line react-prefer-function-component/react-prefer-function-component
class ImportDashboardOverviewUnConnected extends PureComponent<Props, State> {
  state: State = {
    uidReset: false,
  };

  onSubmit = async (form: ImportDashboardDTO) => {
    reportInteraction(IMPORT_FINISHED_EVENT_NAME);

    const { dashboard, inputs, folder } = this.props;

    // when kubernetesDashboard are enabled, we bypass api/dashboard/import
    // and hit the k8s dashboard API directly
    if (config.featureToggles.kubernetesDashboards) {
      // process datasources so the template placeholder is replaced with the actual value user selected
      const annotations = dashboard.annotations.list.map((annotation: AnnotationQuery) => {
        return processAnnotation(annotation, inputs, form);
      });

      const panels = dashboard.panels.map((panel: Panel) => {
        return processPanel(panel, inputs, form);
      });

      const variables = dashboard.templating.list.map((variable: TypedVariableModel) => {
        return processVariable(variable, inputs, form);
      });

      const dashboardWithDataSources: Dashboard = {
        ...dashboard,
        title: form.title,
        annotations,
        panels,
        templating: {
          list: variables,
        },
        uid: form.uid,
      };

      const newLibraryPanels = inputs.libraryPanels.filter((lp) => lp.state === LibraryPanelInputState.New);

      // for library panels that don't exist in the instance, we create them by hitting the library panel API
      for (const lp of newLibraryPanels) {
        const libPanelWithPanelModel = new PanelModel(lp.model.model);
        let { scopedVars, ...panelSaveModel } = libPanelWithPanelModel.getSaveModel();
        panelSaveModel = {
          libraryPanel: {
            name: lp.model.name,
            uid: lp.model.uid,
          },
          ...panelSaveModel,
        };

        try {
          await addLibraryPanel(panelSaveModel, folder.uid);
        } catch (error) {
          console.error('Error adding library panel during dashboard import', error);
        }
      }

      const dashboardK8SPayload: SaveDashboardCommand<Dashboard> = {
        dashboard: dashboardWithDataSources,
        k8s: {
          annotations: {
            'grafana.app/folder': form.folder.uid,
          },
        },
      };

      const result = await getDashboardAPI('v1').saveDashboard(dashboardK8SPayload);

      if (result.url) {
        const dashboardUrl = locationUtil.stripBaseFromUrl(result.url);
        locationService.push(dashboardUrl);
      }

      return;
    }

    this.props.importDashboard(form);
  };

  onCancel = () => {
    this.props.clearLoadedDashboard();
  };

  onUidReset = () => {
    this.setState({ uidReset: true });
  };

  render() {
    const { dashboard, inputs, meta, source, folder } = this.props;
    const { uidReset } = this.state;

    return (
      <>
        {source === DashboardSource.Gcom && (
          <Box marginBottom={3}>
            <div>
              <Legend>
                <Trans i18nKey="manage-dashboards.import-dashboard-overview-un-connected.importing-from">
                  Importing dashboard from{' '}
                  <TextLink href={`https://grafana.com/dashboards/${dashboard.gnetId}`}>Grafana.com</TextLink>
                </Trans>
              </Legend>
            </div>
            <table className="filter-table form-inline">
              <tbody>
                <tr>
                  <td>
                    <Trans i18nKey="manage-dashboards.import-dashboard-overview-un-connected.published-by">
                      Published by
                    </Trans>
                  </td>
                  <td>{meta.orgName}</td>
                </tr>
                <tr>
                  <td>
                    <Trans i18nKey="manage-dashboards.import-dashboard-overview-un-connected.updated-on">
                      Updated on
                    </Trans>
                  </td>
                  <td>{dateTimeFormat(meta.updatedAt)}</td>
                </tr>
              </tbody>
            </table>
          </Box>
        )}
        <Form
          onSubmit={this.onSubmit}
          defaultValues={{ ...dashboard, constants: [], dataSources: [], elements: [], folder: folder }}
          validateOnMount
          validateFieldsOnMount={['title', 'uid']}
          validateOn="onChange"
        >
          {({ register, errors, control, watch, getValues }) => (
            <ImportDashboardForm
              register={register}
              errors={errors}
              control={control}
              getValues={getValues}
              uidReset={uidReset}
              inputs={inputs}
              onCancel={this.onCancel}
              onUidReset={this.onUidReset}
              onSubmit={this.onSubmit}
              watch={watch}
            />
          )}
        </Form>
      </>
    );
  }
}

export const ImportDashboardOverview = connector(ImportDashboardOverviewUnConnected);
ImportDashboardOverview.displayName = 'ImportDashboardOverview';

function hasUid(query: Record<string, unknown> | {}): query is { uid: string } {
  return 'uid' in query && typeof query['uid'] === 'string';
}

/*
Checks whether the templateized uid matches the user prodvided datasource input
*/
function checkUserInputMatch(
  templateizedUid: string,
  datasourceInputs: DataSourceInput[],
  userDsInputs: DataSourceInstanceSettings[]
) {
  const dsName = templateizedUid.replace(/\$\{(.*)\}/, '$1');
  const input = datasourceInputs?.find((ds) => ds.name === dsName);
  const userInput = input && userDsInputs.find((ds) => ds.type === input.pluginId);
  return userInput;
}

function processAnnotation(
  annotation: AnnotationQuery,
  inputs: { dataSources: DataSourceInput[] },
  form: ImportDashboardDTO
): AnnotationQuery {
  if (annotation.datasource && annotation.datasource.uid && annotation.datasource.uid.startsWith('$')) {
    const userInput = checkUserInputMatch(annotation.datasource.uid, inputs.dataSources, form.dataSources);
    if (userInput) {
      return {
        ...annotation,
        datasource: {
          ...annotation.datasource,
          uid: userInput.uid,
        },
      };
    }
  }

  return annotation;
}

function processPanel(panel: Panel, inputs: { dataSources: DataSourceInput[] }, form: ImportDashboardDTO): Panel {
  if (panel.datasource && panel.datasource.uid && panel.datasource.uid.startsWith('$')) {
    const userInput = checkUserInputMatch(panel.datasource.uid, inputs.dataSources, form.dataSources);

    const queries = panel.targets?.map((target) => {
      if (target.datasource && hasUid(target.datasource) && target.datasource.uid.startsWith('$')) {
        const userInput = checkUserInputMatch(target.datasource.uid, inputs.dataSources, form.dataSources);
        if (userInput) {
          return {
            ...target,
            datasource: {
              ...target.datasource,
              uid: userInput.uid,
            },
          };
        }
      }
      return target;
    });

    if (userInput) {
      return {
        ...panel,
        targets: queries,
        datasource: {
          ...panel.datasource,
          uid: userInput.uid,
        },
      };
    }
  }

  return panel;
}

function processVariable(
  variable: TypedVariableModel,
  inputs: { dataSources: DataSourceInput[] },
  form: ImportDashboardDTO
): TypedVariableModel {
  if (variable.type === 'query') {
    if (variable.datasource && variable.datasource.uid?.startsWith('$')) {
      const userInput = checkUserInputMatch(variable.datasource.uid, inputs.dataSources, form.dataSources);
      if (userInput) {
        return {
          ...variable,
          datasource: {
            ...variable.datasource,
            uid: userInput.uid,
          },
        };
      }
    }
  }

  if (variable.type === 'datasource') {
    if (variable.current && variable.current.value && String(variable.current.value).startsWith('$')) {
      const userInput = checkUserInputMatch(String(variable.current.value), inputs.dataSources, form.dataSources);
      if (userInput) {
        return {
          ...variable,
          current: {
            selected: variable.current.selected,
            text: userInput.name,
            value: userInput.uid,
          },
        };
      }
    }
  }

  return variable;
}
