import { http, HttpResponse } from 'msw';
import { render, screen } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { defaultSpec, type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import server, { setupMockServer } from '@grafana/test-utils/server';
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

const v1Spec = {
  title: 'Gcom V1 Dashboard',
  uid: 'gcom-v1-uid',
  schemaVersion: 41,
  panels: [],
  __inputs: [{ name: 'VAR_REGION', label: 'Region', type: 'constant', value: 'eu-west' }],
};

const renderWithGcomResponse = (json: unknown) => {
  server.use(
    http.get('/api/gnet/dashboards/:id', () =>
      HttpResponse.json({ json, updatedAt: '2026-01-01', orgName: 'Grafana Labs' })
    )
  );

  const props = getRouteComponentProps({ queryParams: { gcomDashboardId: '123' } });
  return render(<DashboardImportK8s {...props} />);
};

describe('DashboardImportK8s gcom import', () => {
  it('unwraps a v2 resource into a form filled from its spec, metadata.name, and gcom publisher', async () => {
    renderWithGcomResponse({
      apiVersion: 'dashboard.grafana.app/v2',
      kind: 'Dashboard',
      metadata: { name: 'gcom-v2-uid' },
      spec: v2Spec,
    });

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
