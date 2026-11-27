import { http, HttpResponse } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';

import { AppEvents } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { setBackendSrv } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { defaultSpec, type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { appEvents } from 'app/core/app_events';
import { getRouteComponentProps } from 'app/core/navigation/mocks/routeProps';
import { backendSrv } from 'app/core/services/backend_srv';

import { DashboardImportK8s } from './DashboardImportK8s';

setBackendSrv(backendSrv);
setupMockServer();

const v2Spec: DashboardV2Spec = {
  ...defaultSpec(),
  title: 'Gcom V2 Dashboard',
  variables: [
    {
      kind: 'ConstantVariable',
      spec: {
        name: 'env',
        label: 'Environment',
        query: 'prod',
        current: { text: 'prod', value: 'prod' },
        hide: 'hideVariable',
        skipUrlSync: true,
      },
    },
  ],
};

const v2Resource = {
  apiVersion: 'dashboard.grafana.app/v2',
  kind: 'Dashboard',
  metadata: { name: 'gcom-v2-uid' },
  spec: v2Spec,
};

const v1Spec = {
  title: 'Gcom V1 Dashboard',
  uid: 'gcom-v1-uid',
  schemaVersion: 41,
  panels: [],
  __inputs: [{ name: 'VAR_REGION', label: 'Region', type: 'constant', value: 'eu-west' }],
};

const renderPage = (queryParams = {}) => render(<DashboardImportK8s {...getRouteComponentProps({ queryParams })} />);

const renderWithGcomResponse = (json: unknown) => {
  server.use(
    http.get('/api/gnet/dashboards/:id', () =>
      HttpResponse.json({ json, updatedAt: '2026-01-01', orgName: 'Grafana Labs' })
    )
  );

  return renderPage({ gcomDashboardId: '123' });
};

describe('DashboardImportK8s gcom import', () => {
  it('unwraps a v2 resource into a form filled from its spec, metadata.name, and gcom publisher', async () => {
    renderWithGcomResponse(v2Resource);

    expect(await screen.findByLabelText('Environment')).toHaveValue('prod');
    expect(screen.getByLabelText('Name')).toHaveValue('Gcom V2 Dashboard');
    expect(screen.getByLabelText(/Unique identifier \(UID\)/)).toHaveValue('gcom-v2-uid');
    expect(screen.getByText('Grafana Labs')).toBeInTheDocument();
  });

  it.each([
    {
      name: 'v1 resource',
      json: { apiVersion: 'dashboard.grafana.app/v1', kind: 'Dashboard', metadata: { name: 'x' }, spec: v1Spec },
    },
    { name: 'plain v1 JSON', json: v1Spec },
  ])('fills the form and gcom publisher from a $name', async ({ json }) => {
    renderWithGcomResponse(json);

    expect(await screen.findByLabelText('Region')).toHaveValue('eu-west');
    expect(screen.getByLabelText('Name')).toHaveValue('Gcom V1 Dashboard');
    expect(screen.getByText('Grafana Labs')).toBeInTheDocument();
  });
});

describe('DashboardImportK8s with dashboardNewLayouts disabled', () => {
  beforeEach(() => {
    setTestFlags({ [FlagKeys.DashboardNewLayouts]: false });
  });

  afterEach(async () => {
    // The flag change re-renders the still-mounted form, which must happen inside act.
    await act(async () => {
      setTestFlags({});
    });
  });

  it.each([
    {
      name: 'grafana.com',
      startImport: async () => {
        renderWithGcomResponse(v2Resource);
      },
    },
    {
      name: 'a pasted JSON model',
      startImport: async () => {
        const { user } = renderPage();
        await user.click(screen.getByTestId(selectors.components.DashboardImportPage.textarea));
        await user.paste(JSON.stringify(v2Resource));
        await user.click(screen.getByTestId(selectors.components.DashboardImportPage.submit));
      },
    },
    {
      name: 'an uploaded file',
      startImport: async () => {
        const { user, container } = renderPage();
        const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')!;
        await user.upload(fileInput, new File([JSON.stringify(v2Resource)], 'dashboard.json'));
      },
    },
  ])('blocks a v2 dashboard from $name and keeps the source form', async ({ startImport }) => {
    const emit = jest.spyOn(appEvents, 'emit');

    await startImport();

    await waitFor(() =>
      expect(emit).toHaveBeenCalledWith(AppEvents.alertError, [
        'Import failed',
        'Dashboard using new layout cannot be imported because the feature is not enabled',
      ])
    );
    expect(screen.getByTestId(selectors.components.DashboardImportPage.textarea)).toBeInTheDocument();
    expect(screen.queryByLabelText('Environment')).not.toBeInTheDocument();
  });

  it('still imports a plain v1 dashboard from grafana.com', async () => {
    renderWithGcomResponse(v1Spec);

    expect(await screen.findByLabelText('Region')).toHaveValue('eu-west');
  });
});
