import { render as rtlRender, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { setBackendSrv, config } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';

import { wellFormedDashboardMigrationItem, wellFormedDatasourceMigrationItem } from '../fixtures/migrationItems';
import { registerMockAPI } from '../fixtures/mswAPI';
import { wellFormedDatasource } from '../fixtures/others';

import { ResourcesTable } from './ResourcesTable';

setBackendSrv(backendSrv);

function render(...[ui, options]: Parameters<typeof rtlRender>) {
  rtlRender(<TestProvider>{ui}</TestProvider>, options);
}

describe('ResourcesTable', () => {
  registerMockAPI();

  let originalDatasources: (typeof config)['datasources'];

  const datasourceA = wellFormedDatasource(1, {
    uid: 'datasource-a-uid',
    name: 'Datasource A',
  });

  beforeAll(() => {
    originalDatasources = config.datasources;

    config.datasources = {
      ...config.datasources,
      [datasourceA.name]: datasourceA,
    };
  });

  afterAll(() => {
    config.datasources = originalDatasources;
  });

  it('renders data sources', async () => {
    const resources = [
      wellFormedDatasourceMigrationItem(1, {
        refId: datasourceA.uid,
      }),
    ];

    render(<ResourcesTable resources={resources} />);

    expect(screen.getByText('Datasource A')).toBeInTheDocument();
  });

  it('renders data sources when their data is missing', () => {
    const item = wellFormedDatasourceMigrationItem(2);
    const resources = [item];

    render(<ResourcesTable resources={resources} />);

    expect(screen.getByText(`Data source ${item.refId}`)).toBeInTheDocument();
    expect(screen.getByText(`Unknown data source`)).toBeInTheDocument();
  });

  it('renders dashboards', async () => {
    const resources = [wellFormedDashboardMigrationItem(1)];

    render(<ResourcesTable resources={resources} />);

    expect(await screen.findByText('My Dashboard')).toBeInTheDocument();
  });

  it('renders dashboards when their data is missing', async () => {
    const resources = [
      wellFormedDashboardMigrationItem(2, {
        refId: 'dashboard-404',
      }),
    ];

    render(<ResourcesTable resources={resources} />);

    expect(await screen.findByText('Unable to load dashboard')).toBeInTheDocument();
    expect(await screen.findByText('Dashboard dashboard-404')).toBeInTheDocument();
  });

  it('renders the success status correctly', () => {
    const resources = [
      wellFormedDatasourceMigrationItem(1, {
        refId: datasourceA.uid,
        status: 'OK',
      }),
    ];

    render(<ResourcesTable resources={resources} />);

    expect(screen.getByText('Uploaded to cloud')).toBeInTheDocument();
  });

  it('renders the success error correctly', () => {
    const resources = [
      wellFormedDatasourceMigrationItem(1, {
        refId: datasourceA.uid,
        status: 'ERROR',
      }),
    ];

    render(<ResourcesTable resources={resources} />);

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it("shows a details button when there's an error description", () => {
    const resources = [
      wellFormedDatasourceMigrationItem(1, {
        refId: datasourceA.uid,
        status: 'ERROR',
        error: 'Some error',
      }),
    ];

    render(<ResourcesTable resources={resources} />);

    expect(
      screen.getByRole('button', {
        name: 'Details',
      })
    ).toBeInTheDocument();
  });
});
