import React, { PureComponent } from 'react';
import { dateTime } from '@grafana/data';
import { Forms } from '@grafana/ui';
import { getBackendSrv } from '@grafana/runtime';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { ImportDashboardForm } from './ImportDashboardForm';
import validationSrv from '../services/ValidationSrv';
import { resetDashboard, saveDashboard } from '../state/actions';
import { DashboardSource } from '../state/reducers';
import { StoreState } from 'app/types';

export interface ImportDashboardDTO {
  title: string;
  uid: string;
  gnetId: string;
  folderId?: number;
  inputs: Array<{ name: string; label: string; info: string; type: string; pluginId: string }>;
}

interface OwnProps {}

interface ConnectedProps {
  dashboard: ImportDashboardDTO;
  inputs: any[];
  source: DashboardSource;
  meta?: any;
  folderId?: number;
}

interface DispatchProps {
  resetDashboard: typeof resetDashboard;
  saveDashboard: typeof saveDashboard;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

interface State {
  folderId: number;
  uidReset: boolean;
  titleExists: boolean;
  uidExists: boolean;
}

class ImportDashboardOverviewUnConnected extends PureComponent<Props, State> {
  state: State = {
    folderId: 0,
    uidReset: false,
    titleExists: false,
    uidExists: false,
  };

  onSubmit = (form: ImportDashboardDTO) => {
    this.props.saveDashboard(form.title, form.uid, this.state.folderId);
  };

  onCancel = () => {
    this.props.resetDashboard();
  };

  validateTitle = (newTitle: string) => {
    const { folderId } = this.state;
    return validationSrv
      .validateNewDashboardName(folderId, newTitle)
      .then(() => {
        return false;
      })
      .catch(error => {
        if (error.type === 'EXISTING') {
          this.setState({
            titleExists: true,
          });
          return error.message;
        }
      });
  };

  validateUid = (value: string) => {
    return getBackendSrv()
      .get(`/api/dashboards/uid/${value}`)
      .then(existingDashboard => {
        this.setState({
          uidExists: true,
        });
        return `Dashboard named '${existingDashboard?.dashboard.title}' in folder '${existingDashboard?.meta.folderTitle}' has the same uid`;
      })
      .catch(error => {
        error.isHandled = true;
        return false;
      });
  };

  onUidReset = () => {
    this.setState({ uidReset: true });
  };

  render() {
    const { dashboard, inputs, meta, source } = this.props;
    const { uidReset, titleExists, uidExists } = this.state;

    return (
      <>
        {source === DashboardSource.Gcom && (
          <div style={{ marginBottom: '24px' }}>
            <div>
              <Forms.Legend>
                Importing Dashboard from{' '}
                <a
                  href={`https://grafana.com/dashboards/${dashboard.gnetId}`}
                  className="external-link"
                  target="_blank"
                >
                  Grafana.com
                </a>
              </Forms.Legend>
            </div>
            <table className="filter-table form-inline">
              <tbody>
                <tr>
                  <td>Published by</td>
                  <td>{meta.orgName}</td>
                </tr>
                <tr>
                  <td>Updated on</td>
                  <td>{dateTime(meta.updatedAt).format('YYYY-MM-DD HH:mm:ss')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <Forms.Form onSubmit={this.onSubmit} defaultValues={dashboard} validateOnMount>
          {({ register, errors, control, getValues }) => (
            <ImportDashboardForm
              register={register}
              errors={errors}
              control={control}
              getValues={getValues}
              uidReset={uidReset}
              inputs={inputs}
              uidExists={uidExists}
              titleExists={titleExists}
              onCancel={this.onCancel}
              onUidReset={this.onUidReset}
              onSubmit={this.onSubmit}
              validateTitle={this.validateTitle}
              validateUid={this.validateUid}
            />
          )}
        </Forms.Form>
      </>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state: StoreState) => ({
  dashboard: state.importDashboard.dashboard,
  meta: state.importDashboard.meta,
  source: state.importDashboard.source,
  inputs: state.importDashboard.inputs,
  folderId: state.location.routeParams.folderId ? Number(state.location.routeParams.folderId) : 0,
});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  resetDashboard,
  saveDashboard,
};

export const ImportDashboardOverview = connect(mapStateToProps, mapDispatchToProps)(ImportDashboardOverviewUnConnected);
ImportDashboardOverview.displayName = 'ImportDashboardOverview';
