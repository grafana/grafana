import { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { AppEvents, LoadingState, NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { Alert, Button, Spinner, Stack } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { Form } from 'app/core/components/Form/Form';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { isRecord } from 'app/core/utils/isRecord';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { dispatch } from 'app/store/store';
import { StoreState } from 'app/types/store';

import { cleanUpAction } from '../../../../core/actions/cleanUp';
import { GcomDashboardInfo } from '../components/GcomDashboardInfo';
import { ImportForm } from '../components/ImportForm';
import { ImportSourceForm } from '../components/ImportSourceForm';
import { DashboardSource, ImportDashboardDTO } from '../types';
import { detectImportModel, ImportModel } from '../utils/detect';

import {
  clearLoadedDashboard,
  fetchGcomDashboard,
  importDashboard,
  importDashboardJson,
  importDashboardV2Json,
} from './actions';
import { initialImportDashboardState } from './reducers';

function getV1ResourceSpec(dashboard: unknown): Record<string, unknown> | undefined {
  if (!isRecord(dashboard) || !('spec' in dashboard)) {
    return undefined;
  }
  const spec = dashboard.spec;
  if (!isRecord(spec) || isDashboardV2Spec(spec)) {
    return undefined;
  }
  return spec;
}

const IMPORT_STARTED_EVENT_NAME = 'dashboard_import_loaded';

// =====================
// ImportResourceFormatError - Inline component for legacy error handling
// =====================
function ImportResourceFormatError({ model, onCancel }: { model: ImportModel; onCancel: () => void }) {
  const errorMessage =
    model === 'v1-resource'
      ? t(
          'manage-dashboards.import-resource-format-error.v1-message',
          'This dashboard is in Kubernetes v1 resource format and cannot be imported when Kubernetes dashboards feature is disabled. Please enable the kubernetesDashboards feature toggle to import this dashboard.'
        )
      : t(
          'manage-dashboards.import-resource-format-error.v2-message',
          'This dashboard is in v2 resource format and cannot be imported when Kubernetes dashboards feature is disabled. Please enable the kubernetesDashboards feature toggle to import this dashboard.'
        );

  return (
    <Stack direction="column" gap={2}>
      <Alert title={t('manage-dashboards.import-resource-format-error.title', 'Unsupported format')} severity="error">
        {errorMessage}
      </Alert>
      <Stack>
        <Button variant="secondary" onClick={onCancel}>
          <Trans i18nKey="manage-dashboards.import-resource-format-error.cancel">Cancel</Trans>
        </Button>
      </Stack>
    </Stack>
  );
}

// =====================
// ImportOverview - Inline Redux-connected component for legacy overview
// =====================
const overviewMapStateToProps = (state: StoreState) => {
  const searchObj = locationService.getSearchObject();
  return {
    dashboard: state.importDashboard.dashboard,
    meta: state.importDashboard.meta,
    source: state.importDashboard.source,
    inputs: state.importDashboard.inputs,
    folder: searchObj.folderUid ? { uid: String(searchObj.folderUid) } : { uid: '' },
  };
};

const overviewMapDispatchToProps = {
  clearLoadedDashboard,
  importDashboard,
};

const overviewConnector = connect(overviewMapStateToProps, overviewMapDispatchToProps);
type OverviewProps = ConnectedProps<typeof overviewConnector>;

// eslint-disable-next-line react-prefer-function-component/react-prefer-function-component
class ImportOverviewUnConnected extends PureComponent<OverviewProps, { uidReset: boolean }> {
  state = { uidReset: false };

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

const ImportOverview = overviewConnector(ImportOverviewUnConnected);

// =====================
// DashboardImportLegacy - Main Redux-connected page component
// =====================
type DashboardImportPageRouteSearchParams = {
  gcomDashboardId?: string;
};

type OwnProps = GrafanaRouteComponentProps<{}, DashboardImportPageRouteSearchParams>;

const mapStateToProps = (state: StoreState) => ({
  loadingState: state.importDashboard.state,
  dashboard: state.importDashboard.dashboard,
});

const mapDispatchToProps = {
  fetchGcomDashboard,
  importDashboardJson,
  clearLoadedDashboard,
  cleanUpAction,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = OwnProps & ConnectedProps<typeof connector>;

// eslint-disable-next-line react-prefer-function-component/react-prefer-function-component
class UnthemedDashboardImportLegacy extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
    const { gcomDashboardId } = this.props.queryParams;
    if (gcomDashboardId) {
      this.handleGcomSubmit({ gcomDashboard: gcomDashboardId });
      return;
    }
  }

  componentWillUnmount() {
    this.props.cleanUpAction({ cleanupAction: (state) => (state.importDashboard = initialImportDashboardState) });
  }

  handleFileUpload = (result: string | ArrayBuffer | null) => {
    reportInteraction(IMPORT_STARTED_EVENT_NAME, {
      import_source: 'json_uploaded',
    });

    try {
      const json = JSON.parse(String(result));

      if (json.spec?.elements) {
        return dispatch(importDashboardV2Json(json.spec));
      } else if (json.elements) {
        return dispatch(importDashboardV2Json(json));
      }

      const v1ResourceSpec = getV1ResourceSpec(json);
      if (v1ResourceSpec) {
        return this.props.importDashboardJson(v1ResourceSpec);
      }

      this.props.importDashboardJson(json);
    } catch (error) {
      if (error instanceof Error) {
        appEvents.emit(AppEvents.alertError, ['Import failed', 'JSON -> JS Serialization failed: ' + error.message]);
      }
      return;
    }
  };

  handleJsonSubmit = (formData: { dashboardJson: string }) => {
    reportInteraction(IMPORT_STARTED_EVENT_NAME, {
      import_source: 'json_pasted',
    });

    const dashboard = JSON.parse(formData.dashboardJson);

    if ((dashboard.spec?.elements || dashboard.elements) && !config.featureToggles.dashboardNewLayouts) {
      return appEvents.emit(AppEvents.alertError, [
        'Import failed',
        'Dashboard using new layout cannot be imported because the feature is not enabled',
      ]);
    }

    const model = detectImportModel(dashboard);
    if (model === 'v2-resource' && dashboard.spec?.elements) {
      return dispatch(importDashboardV2Json(dashboard.spec));
    }

    if (model === 'v2-resource' && dashboard.elements) {
      return dispatch(importDashboardV2Json(dashboard));
    }

    const v1ResourceSpec = getV1ResourceSpec(dashboard);
    if (v1ResourceSpec) {
      return this.props.importDashboardJson(v1ResourceSpec);
    }

    this.props.importDashboardJson(dashboard);
  };

  handleGcomSubmit = (formData: { gcomDashboard: string }) => {
    reportInteraction(IMPORT_STARTED_EVENT_NAME, {
      import_source: 'gcom',
    });

    let dashboardId;
    const match = /(^\d+$)|dashboards\/(\d+)/.exec(formData.gcomDashboard);
    if (match && match[1]) {
      dashboardId = match[1];
    } else if (match && match[2]) {
      dashboardId = match[2];
    }

    if (dashboardId) {
      this.props.fetchGcomDashboard(dashboardId);
    }
  };

  pageNav: NavModelItem = {
    text: t('manage-dashboards.unthemed-dashboard-import.text.import-dashboard', 'Import dashboard'),
    subTitle: t(
      'manage-dashboards.unthemed-dashboard-import.subTitle.import-dashboard-from-file-or-grafanacom',
      'Import dashboard from file or Grafana.com'
    ),
  };

  getDashboardOverview() {
    const { loadingState, dashboard } = this.props;

    if (loadingState === LoadingState.Done) {
      const model = detectImportModel(dashboard);

      // k8s disabled but resource format -> show error
      if (model === 'v1-resource' || model === 'v2-resource') {
        return <ImportResourceFormatError model={model} onCancel={this.props.clearLoadedDashboard} />;
      }

      // k8s disabled + classic -> legacy redux path
      return <ImportOverview />;
    }

    return null;
  }

  render() {
    const { loadingState } = this.props;

    return (
      <Page navId="dashboards/browse" pageNav={this.pageNav}>
        <Page.Contents>
          {loadingState === LoadingState.Loading && (
            <Stack direction={'column'} justifyContent="center">
              <Stack justifyContent="center">
                <Spinner size="xxl" />
              </Stack>
            </Stack>
          )}
          {[LoadingState.Error, LoadingState.NotStarted].includes(loadingState) && (
            <ImportSourceForm
              onFileUpload={this.handleFileUpload}
              onGcomSubmit={this.handleGcomSubmit}
              onJsonSubmit={this.handleJsonSubmit}
            />
          )}
          {this.getDashboardOverview()}
        </Page.Contents>
      </Page>
    );
  }
}

export const DashboardImportLegacy = connector(UnthemedDashboardImportLegacy);
DashboardImportLegacy.displayName = 'DashboardImportLegacy';
