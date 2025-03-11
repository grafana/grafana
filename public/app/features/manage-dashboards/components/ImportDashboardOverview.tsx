import { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { dateTimeFormat } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Box, Legend } from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';
import { StoreState } from 'app/types';

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
                Importing dashboard from{' '}
                <a
                  href={`https://grafana.com/dashboards/${dashboard.gnetId}`}
                  className="external-link"
                  target="_blank"
                  rel="noreferrer"
                >
                  Grafana.com
                </a>
              </Legend>
            </div>
            <table className="filter-table form-inline">
              <tbody>
                <tr>
                  <td>Published by</td>
                  <td>{meta.orgName}</td>
                </tr>
                <tr>
                  <td>Updated on</td>
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
