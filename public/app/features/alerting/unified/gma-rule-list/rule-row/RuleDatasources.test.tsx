import { render, screen } from 'test/test-utils';

import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';

import { RuleDatasources } from './RuleDatasources';

describe('RuleDatasources', () => {
  it('shows a single datasource as logo and name link', () => {
    setupDataSources(mockDataSource({ uid: 'ds-1', name: 'Prometheus' }));

    render(<RuleDatasources datasourceUIDs={['ds-1']} />);

    expect(screen.getByRole('link', { name: 'Prometheus' })).toHaveAttribute('href', expect.stringContaining('ds-1'));
  });

  it('shows multiple datasources as logos and a count', () => {
    setupDataSources(
      mockDataSource({ uid: 'ds-1', name: 'Prometheus' }),
      mockDataSource({ uid: 'ds-2', name: 'Loki' })
    );

    render(<RuleDatasources datasourceUIDs={['ds-1', 'ds-2']} />);

    expect(screen.getByText('2 data sources')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('deduplicates repeated UIDs', () => {
    setupDataSources(mockDataSource({ uid: 'ds-1', name: 'Prometheus' }));

    render(<RuleDatasources datasourceUIDs={['ds-1', 'ds-1']} />);

    expect(screen.getByRole('link', { name: 'Prometheus' })).toBeInTheDocument();
    expect(screen.queryByText('2 data sources')).not.toBeInTheDocument();
  });

  it('renders nothing when no UIDs are given', () => {
    const { container } = render(<RuleDatasources datasourceUIDs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when none of the UIDs resolve to a known datasource', () => {
    const { container } = render(<RuleDatasources datasourceUIDs={['unknown-uid']} />);
    expect(container).toBeEmptyDOMElement();
  });
});
