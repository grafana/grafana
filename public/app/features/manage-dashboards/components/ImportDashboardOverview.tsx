import React, { PureComponent } from 'react';
import { dateTimeFormat } from '@grafana/data';
import { Legend, Form } from '@grafana/ui';
import { connect, ConnectedProps } from 'react-redux';
import { ImportDashboardForm } from './ImportDashboardForm';
import { clearLoadedDashboard, importDashboard } from '../state/actions';
import { DashboardSource, ImportDashboardDTO } from '../state/reducers';
import { StoreState } from 'app/types';
import { locationService } from '@grafana/runtime';

const mapStateToProps = (state: StoreState) => {
  const searchObj = locationService.getSearchObject();

  return {
    dashboard: state.importDashboard.dashboard,
    meta: state.importDashboard.meta,
    source: state.importDashboard.source,
    inputs: state.importDashboard.inputs,
    folder: searchObj.folderId ? { id: Number(searchObj.folderId) } : { id: 0 },
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
          </div>
        )}
        <Form
          onSubmit={this.onSubmit}
          defaultValues={{ ...dashboard, constants: [], dataSources: [], folder: folder }}
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
              initialFolderId={folder.id}
            />
          )}
        </Form>
      </>
    );
  }
}

export const ImportDashboardOverview = connector(ImportDashboardOverviewUnConnected);
ImportDashboardOverview.displayName = 'ImportDashboardOverview';
