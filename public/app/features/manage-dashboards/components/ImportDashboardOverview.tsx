import { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { dateTimeFormat, TypedVariableModel } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { locationService, reportInteraction, config } from '@grafana/runtime';
import { AnnotationQuery } from '@grafana/schema/dist/esm/veneer/dashboard.types';
import { Box, Legend, TextLink } from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { DashboardDataDTO, DashboardDTO } from 'app/types/dashboard';
import { StoreState } from 'app/types/store';

import { clearLoadedDashboard, importDashboard } from '../state/actions';
import { DashboardSource, ImportDashboardDTO } from '../state/reducers';

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

class ImportDashboardOverviewUnConnected extends PureComponent<Props, State> {
  state: State = {
    uidReset: false,
  };

  onSubmit = (form: ImportDashboardDTO) => {
    reportInteraction(IMPORT_FINISHED_EVENT_NAME);

    const { dashboard, inputs, folder } = this.props;

    // TODO: add logic when kubernetesDashboards are enabled
    if (config.featureToggles.kubernetesDashboards) {
      // 1. process datasources so the template placeholder is replaced with the actual value user selected

      const annotations = dashboard.annotations.list.map((annotation: AnnotationQuery) => {
        if (annotation.datasource && annotation.datasource.uid && annotation.datasource.uid.startsWith('$')) {
          // clean ${} from the datasource name
          const dsName = annotation.datasource.uid.replace(/\$\{(.*)\}/, '$1');
          const input = inputs.dataSources.find((ds) => ds.name === dsName);
          const userInput = input && form.dataSources.find((ds) => ds.type === input.pluginId);
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
      });

      const panels = dashboard.panels.map((panel: any) => {
        if (panel.datasource && panel.datasource.uid && panel.datasource.uid.startsWith('$')) {
          // clean ${} from the datasource name
          const dsName = panel.datasource.uid.replace(/\$\{(.*)\}/, '$1');
          const input = inputs.dataSources.find((ds) => ds.name === dsName);
          const userInput = input && form.dataSources.find((ds) => ds.type === input.pluginId);

          const queries = panel.targets.map((target: any) => {
            if (target.datasource && target.datasource.uid && target.datasource.uid.startsWith('$')) {
              const dsName = target.datasource.uid.replace(/\$\{(.*)\}/, '$1');
              const input = inputs.dataSources.find((ds) => ds.name === dsName);
              const userInput = input && form.dataSources.find((ds) => ds.type === input.pluginId);
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

          panel = {
            ...panel,
            targets: queries,
          };

          if (userInput) {
            return {
              ...panel,
              datasource: {
                ...panel.datasource,
                uid: userInput.uid,
              },
            };
          }
        }
        return panel;
      });

      const variables = dashboard.templating.list.map((variable: TypedVariableModel) => {
        if (variable.type === 'query') {
          if (variable.datasource && variable.datasource.uid?.startsWith('$')) {
            // clean ${} from the datasource name
            const dsName = variable.datasource.uid.replace(/\$\{(.*)\}/, '$1');
            const input = inputs.dataSources.find((ds) => ds.name === dsName);
            const userInput = input && form.dataSources.find((ds) => ds.type === input.pluginId);
            if (userInput) {
              return {
                ...variable,
                datasource: userInput.uid,
              };
            }
          }
        }

        if (variable.type === 'datasource') {
          if (variable.current && variable.current.value && String(variable.current.value).startsWith('$')) {
            // clean ${} from the datasource name
            const dsName = String(variable.current.value).replace(/\$\{(.*)\}/, '$1');
            const input = inputs.dataSources.find((ds) => ds.name === dsName);
            const userInput = input && form.dataSources.find((ds) => ds.type === input.pluginId);
            if (userInput) {
              return {
                ...variable,
                current: {
                  ...variable.current,
                  value: userInput.uid,
                },
              };
            }
          }
        }

        return variable;
      });

      const dashboardWithDataSources: DashboardDataDTO = {
        ...dashboard,
        title: form.title,
        annotations,
      };
      // 2. if library panel doesn't exist in the instance, create it by hitting the library panel API
      // you can use getLibraryPanel or getLibraryPanelInputs to check if panel exists and addLibraryPanel from library panel from public/app/features/library-panels/state/api.ts

      // 3. hit v1 API POST directly

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
