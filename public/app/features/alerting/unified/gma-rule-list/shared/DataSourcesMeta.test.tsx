import { render, screen } from 'test/test-utils';

import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';

import { DataSourcesMeta } from './DataSourcesMeta';

const prom = mockDataSource({ uid: 'prom-uid', name: 'Prom Main' });
const loki = mockDataSource({ uid: 'loki-uid', name: 'Loki Logs', type: 'loki' });

describe('DataSourcesMeta', () => {
  beforeEach(() => {
    setupDataSources(prom, loki);
  });

  it('shows a single data source as a link to its settings', () => {
    render(<DataSourcesMeta uids={['prom-uid', 'prom-uid']} />);

    expect(screen.getByRole('link', { name: 'Prom Main' })).toHaveAttribute('href', '/datasources/edit/prom-uid');
  });

  it('shows several data sources as logos with a count instead of links', () => {
    render(<DataSourcesMeta uids={['prom-uid', 'loki-uid']} />);

    expect(screen.getByText('2 data sources')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Prom Main' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Loki Logs' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('skips unknown uids and renders nothing when none resolve', () => {
    const { container } = render(<DataSourcesMeta uids={['gone']} />);
    expect(container).toBeEmptyDOMElement();
  });
});
