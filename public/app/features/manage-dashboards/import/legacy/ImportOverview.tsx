import { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { locationService, reportInteraction } from '@grafana/runtime';
import { Form } from 'app/core/components/Form/Form';
import { StoreState } from 'app/types/store';

import { clearLoadedDashboard, importDashboard } from '../../state/actions';
import { DashboardSource, ImportDashboardDTO } from '../../state/reducers';
import { GcomDashboardInfo } from '../components/GcomDashboardInfo';
import { ImportForm } from '../components/ImportForm';

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
class ImportOverviewUnConnected extends PureComponent<Props, State> {
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
          <GcomDashboardInfo gnetId={dashboard.gnetId} orgName={meta.orgName} updatedAt={meta.updatedAt} />
        )}
        <Form
          onSubmit={this.onSubmit}
          defaultValues={{ ...dashboard, constants: [], dataSources: [], elements: [], folder: folder }}
          validateOnMount
          validateFieldsOnMount={['title', 'uid']}
          validateOn="onChange"
        >
          {({ register, errors, control, watch, getValues }) => (
            <ImportForm
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

export const ImportOverview = connector(ImportOverviewUnConnected);
ImportOverview.displayName = 'ImportOverview';
