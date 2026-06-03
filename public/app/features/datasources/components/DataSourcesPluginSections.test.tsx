import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { getMockDataSource } from '../mocks/dataSourcesMocks';

import { DataSourcesPluginSections, groupDataSourcesByPlugin } from './DataSourcesPluginSections';

jest.mock('../state/useDataSourceHealth', () => ({
  useDataSourceHealth: () => ({ status: 'healthy' }),
}));

const makeDataSources = (promCount = 2) => [
  ...Array.from({ length: promCount }, (_, i) =>
    getMockDataSource({
      uid: `prom-${i}`,
      name: `prom-${i}`,
      type: 'prometheus',
      typeName: 'Prometheus',
      isDefault: i === 0,
      created: '2026-01-15T10:00:00Z',
    })
  ),
  getMockDataSource({ uid: 'loki-0', name: 'loki-0', type: 'loki', typeName: 'Loki' }),
];

const setup = (dataSources = makeDataSources()) =>
  render(<DataSourcesPluginSections dataSources={dataSources} hasWriteRights={true} hasExploreRights={true} />);

describe('groupDataSourcesByPlugin', () => {
  it('groups data sources by plugin type and keeps their instances', () => {
    const groups = groupDataSourcesByPlugin(makeDataSources());

    const prometheus = groups.find((g) => g.type === 'prometheus');
    const loki = groups.find((g) => g.type === 'loki');

    expect(prometheus).toMatchObject({ typeName: 'Prometheus', hasDefault: true });
    expect(prometheus?.dataSources).toHaveLength(2);
    expect(loki?.dataSources).toHaveLength(1);
  });

  it('sorts groups alphabetically by type name', () => {
    const groups = groupDataSourcesByPlugin(makeDataSources());
    expect(groups.map((g) => g.typeName)).toEqual(['Loki', 'Prometheus']);
  });
});

describe('<DataSourcesPluginSections>', () => {
  it('renders a section per plugin type, collapsed by default', () => {
    setup();

    expect(screen.getByText('Prometheus')).toBeInTheDocument();
    expect(screen.getByText('Loki')).toBeInTheDocument();
    // Closed by default: instance rows are not rendered yet.
    expect(screen.queryByText('prom-0')).not.toBeInTheDocument();
  });

  it('reveals the instance rows with health and created date when a section is expanded', async () => {
    const { user } = setup();

    await user.click(screen.getByText('Prometheus'));

    expect(screen.getByText('prom-0')).toBeInTheDocument();
    expect(screen.getByText('prom-1')).toBeInTheDocument();
    // Live health check indicator + created date appear on each row.
    expect(screen.getAllByText('Healthy').length).toBe(2);
    expect(screen.getAllByText(/Created \d{4}-\d{2}-\d{2}/).length).toBe(2);
  });

  it('shows only the first 5 instances and a "more" link when there are more', async () => {
    const { user } = setup(makeDataSources(7));

    await user.click(screen.getByText('Prometheus'));

    expect(screen.getByText('prom-0')).toBeInTheDocument();
    expect(screen.getByText('prom-4')).toBeInTheDocument();
    expect(screen.queryByText('prom-5')).not.toBeInTheDocument();

    const moreLink = screen.getByRole('link', { name: /View all 7 Prometheus data sources/ });
    expect(moreLink).toHaveAttribute('href', expect.stringContaining('/connections/datasources/by-type/prometheus'));
  });

  it('does not show a "more" link when there are 5 or fewer instances', async () => {
    const { user } = setup(makeDataSources(5));

    await user.click(screen.getByText('Prometheus'));

    expect(screen.queryByRole('link', { name: /View all/ })).not.toBeInTheDocument();
  });
});
