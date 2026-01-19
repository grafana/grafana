import { useState, useEffect } from 'react';

import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getBackendSrv, isFetchError, reportInteraction } from '@grafana/runtime';
import { Spinner, Stack } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { DashboardInputs, DashboardSource } from '../state/reducers';

import { ImportOverview } from './ImportOverview';
import { ImportSourceForm } from './components/ImportSourceForm';
import { detectImportModel, ImportModel } from './detect';
import { processInputsFromDashboard, processV2Inputs } from './process';

const IMPORT_STARTED_EVENT_NAME = 'dashboard_import_loaded';

type RouteParams = {};
type QueryParams = { gcomDashboardId?: string };

type Props = GrafanaRouteComponentProps<RouteParams, QueryParams>;

type ImportState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  dashboard: unknown;
  inputs: DashboardInputs;
  meta: { updatedAt: string; orgName: string };
  source: DashboardSource;
  model: ImportModel;
};

const initialState: ImportState = {
  status: 'idle',
  dashboard: {},
  inputs: { dataSources: [], constants: [], libraryPanels: [] },
  meta: { updatedAt: '', orgName: '' },
  source: DashboardSource.Json,
  model: 'classic',
};

export function DashboardImportK8s({ queryParams }: Props) {
  const [state, setState] = useState<ImportState>(initialState);

  // Handle gcom dashboard ID from query params on mount
  useEffect(() => {
    const { gcomDashboardId } = queryParams;
    if (gcomDashboardId) {
      fetchGcomDashboard(gcomDashboardId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchGcomDashboard(id: string) {
    reportInteraction(IMPORT_STARTED_EVENT_NAME, { import_source: 'gcom' });

    setState((prev) => ({ ...prev, status: 'loading' }));

    try {
      const response = await getBackendSrv().get(`/api/gnet/dashboards/${id}`);
      const dashboard = response.json;
      const model = detectImportModel(dashboard);
      const inputs = model === 'v2-resource' ? processV2Inputs(dashboard) : await processInputsFromDashboard(dashboard);

      setState({
        status: 'ready',
        dashboard,
        inputs,
        meta: { updatedAt: response.updatedAt, orgName: response.orgName },
        source: DashboardSource.Gcom,
        model,
      });
    } catch (error) {
      setState((prev) => ({ ...prev, status: 'error' }));
      if (isFetchError(error)) {
        appEvents.emit(AppEvents.alertError, ['Failed to load dashboard', error.data?.message || 'Unknown error']);
      }
    }
  }

  async function handleFileUpload(result: string | ArrayBuffer | null) {
    reportInteraction(IMPORT_STARTED_EVENT_NAME, { import_source: 'json_uploaded' });

    try {
      const json = JSON.parse(String(result));
      await processDashboardJson(json);
    } catch (error) {
      if (error instanceof Error) {
        appEvents.emit(AppEvents.alertError, ['Import failed', 'JSON -> JS Serialization failed: ' + error.message]);
      }
    }
  }

  async function handleJsonPaste(formData: { dashboardJson: string }) {
    reportInteraction(IMPORT_STARTED_EVENT_NAME, { import_source: 'json_pasted' });

    const json = JSON.parse(formData.dashboardJson);

    if ((json.spec?.elements || json.elements) && !config.featureToggles.dashboardNewLayouts) {
      appEvents.emit(AppEvents.alertError, [
        'Import failed',
        'Dashboard using new layout cannot be imported because the feature is not enabled',
      ]);
      return;
    }

    await processDashboardJson(json);
  }

  async function processDashboardJson(json: unknown) {
    setState((prev) => ({ ...prev, status: 'loading' }));

    try {
      // Extract spec if it's a k8s resource wrapper
      let dashboard = json;
      if (isRecord(json) && isRecord(json.spec)) {
        dashboard = json.spec;
      }

      const model = detectImportModel(json);
      const inputs = model === 'v2-resource' ? processV2Inputs(dashboard) : await processInputsFromDashboard(dashboard);

      setState({
        status: 'ready',
        dashboard,
        inputs,
        meta: { updatedAt: '', orgName: '' },
        source: DashboardSource.Json,
        model,
      });
    } catch (error) {
      setState((prev) => ({ ...prev, status: 'error' }));
      const message = error instanceof Error ? error.message : 'Unknown error';
      appEvents.emit(AppEvents.alertError, ['Failed to process dashboard', message]);
    }
  }

  function handleGcomSubmit(formData: { gcomDashboard: string }) {
    let dashboardId;
    const match = /(^\d+$)|dashboards\/(\d+)/.exec(formData.gcomDashboard);
    if (match && match[1]) {
      dashboardId = match[1];
    } else if (match && match[2]) {
      dashboardId = match[2];
    }

    if (dashboardId) {
      fetchGcomDashboard(dashboardId);
    }
  }

  function handleCancel() {
    setState(initialState);
  }

  const pageNav = {
    text: t('manage-dashboards.unthemed-dashboard-import.text.import-dashboard', 'Import dashboard'),
    subTitle: t(
      'manage-dashboards.unthemed-dashboard-import.subTitle.import-dashboard-from-file-or-grafanacom',
      'Import dashboard from file or Grafana.com'
    ),
  };

  return (
    <Page navId="dashboards/browse" pageNav={pageNav}>
      <Page.Contents>
        {state.status === 'loading' && (
          <Stack direction="column" justifyContent="center">
            <Stack justifyContent="center">
              <Spinner size="xxl" />
            </Stack>
          </Stack>
        )}

        {(state.status === 'idle' || state.status === 'error') && (
          <ImportSourceForm
            onFileUpload={handleFileUpload}
            onGcomSubmit={handleGcomSubmit}
            onJsonSubmit={handleJsonPaste}
          />
        )}

        {state.status === 'ready' && (
          <ImportOverview
            dashboard={state.dashboard}
            inputs={state.inputs}
            meta={state.meta}
            source={state.source}
            model={state.model}
            onCancel={handleCancel}
          />
        )}
      </Page.Contents>
    </Page>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
