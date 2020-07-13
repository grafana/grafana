import React, { PureComponent } from 'react';
import { dateTimeFormat } from '@grafana/data';
import { Legend, Form } from '@grafana/ui';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { ImportDashboardForm } from './ImportDashboardForm';
import { clearLoadedDashboard, importDashboard } from '../state/actions';
import { DashboardInputs, DashboardSource, ImportDashboardDTO } from '../state/reducers';
import { StoreState } from 'app/types';

interface OwnProps {}

interface ConnectedProps {
  dashboard: ImportDashboardDTO;
  inputs: DashboardInputs;
  source: DashboardSource;
  meta?: any;
  folder: { id: number; title?: string };
}

interface DispatchProps {
  clearLoadedDashboard: typeof clearLoadedDashboard;
  importDashboard: typeof importDashboard;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

interface State {
  uidReset: boolean;
}

class ImportDashboardOverviewUnConnected extends PureComponent<Props, State> {
  state: State = {
    uidReset: false,
  };

  onSubmit = (form: ImportDashboardDTO) => {
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
          <div style={{ marginBottom: '24px' }}>
            <div>
              <Legend>
                Importing Dashboard from{' '}
                <a
                  href={`https://grafana.com/dashboards/${dashboard.gnetId}`}
                  className="external-link"
                  target="_blank"
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
          </div>
        )}
        <Form
          onSubmit={this.onSubmit}
          defaultValues={{ ...dashboard, constants: [], dataSources: [], folder: folder }}
          validateOnMount
          validateFieldsOnMount={['title', 'uid']}
          validateOn="onChange"
        >
          {({ register, errors, control, getValues }) => (
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
              initialFolderId={folder.id}
            />
          )}
        </Form>
      </>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state: StoreState) => ({
  dashboard: state.importDashboard.dashboard,
  meta: state.importDashboard.meta,
  source: state.importDashboard.source,
  inputs: state.importDashboard.inputs,
  folder: state.location.routeParams.folderId ? { id: Number(state.location.routeParams.folderId) } : { id: 0 },
});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  clearLoadedDashboard,
  importDashboard,
};

export const ImportDashboardOverview = connect(mapStateToProps, mapDispatchToProps)(ImportDashboardOverviewUnConnected);
ImportDashboardOverview.displayName = 'ImportDashboardOverview';
