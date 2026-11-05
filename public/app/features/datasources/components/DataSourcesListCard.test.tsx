import { render, screen } from 'test/test-utils';

import { type DataSourceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';

import { DataSourcesListCard } from './DataSourcesListCard';

const dataSource = {
  uid: 'prom-uid',
  name: 'Prometheus',
  type: 'prometheus',
  typeName: 'Prometheus',
  typeLogoUrl: 'prom.svg',
  url: 'http://prom:9090',
} as DataSourceSettings;

function renderCard(annotations?: Record<string, string>) {
  render(
    <DataSourcesListCard dataSource={{ ...dataSource, annotations }} hasWriteRights={true} hasExploreRights={false} />
  );
}

describe('DataSourcesListCard', () => {
  const originalProvisioningEnabled = config.provisioningEnabled;

  beforeEach(() => {
    config.provisioningEnabled = true;
  });

  afterAll(() => {
    config.provisioningEnabled = originalProvisioningEnabled;
  });

  // The annotations only arrive when the list was read from an API group; the legacy endpoint has
  // no column for them, so the badge is simply absent there rather than wrong.
  it('shows the managed badge for a repository-managed data source', () => {
    renderCard({ 'grafana.app/managedBy': 'repo', 'grafana.app/managerId': 'my-repo' });

    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
  });

  it('shows no badge when the data source is unmanaged', () => {
    renderCard({ 'grafana.app/updatedBy': 'user:1' });

    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
  });

  it('shows no badge when the list carries no annotations', () => {
    renderCard(undefined);

    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
  });
});
