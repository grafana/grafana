import { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { dateTimeFormat } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Box, Legend, TextLink } from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { queryResultToViewItem } from 'app/features/search/service/utils';
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
  defaultFolder: { uid: string } | null;
}

class ImportDashboardOverviewUnConnected extends PureComponent<Props, State> {
  state: State = {
    uidReset: false,
    // NI fork: if a folderUid is already in the URL we can use it immediately;
    // otherwise stay null until componentDidMount resolves it.
    defaultFolder: this.props.folder.uid !== '' ? this.props.folder : null,
  };

  // NI fork: replicate OldFolderPicker behaviour – when no folder is pre-selected
  // via URL param, search for the first folder whose title starts with "Default"
  async componentDidMount() {
    if (this.props.folder.uid === '') {
      try {
        const queryResponse = await getGrafanaSearcher().search({
          query: 'Default',
          kind: ['folder'],
          limit: 100,
        });
        const items = queryResponse.view.map((v) => queryResultToViewItem(v, queryResponse.view));
        const match = items.find((item) => item.title.startsWith('Default'));
        this.setState({ defaultFolder: { uid: match?.uid ?? '' } });
      } catch {
        this.setState({ defaultFolder: { uid: '' } });
      }
    }
  }

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
    const { dashboard, inputs, meta, source } = this.props;
    const { uidReset, defaultFolder } = this.state;

    // NI fork: wait until the default folder has been resolved before mounting
    // the form (react-hook-form only reads defaultValues on first mount).
    if (!defaultFolder) {
      return null;
    }

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
          defaultValues={{ ...dashboard, constants: [], dataSources: [], elements: [], folder: defaultFolder }}
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
