import { render, screen } from 'test/test-utils';

import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';

import { RuleRecordedMetric } from './RuleRecordedMetric';

describe('RuleRecordedMetric', () => {
  it('shows the metric name and target datasource name as a link', () => {
    setupDataSources(mockDataSource({ uid: 'ds-mimir', name: 'Mimir' }));

    render(<RuleRecordedMetric metric="cpu:usage:rate5m" targetDatasourceUID="ds-mimir" />);

    expect(screen.getByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mimir' })).toHaveAttribute('href', expect.stringContaining('ds-mimir'));
  });

  it('falls back to the UID as plain text when the datasource does not resolve', () => {
    render(<RuleRecordedMetric metric="cpu:usage:rate5m" targetDatasourceUID="unknown-uid" />);

    expect(screen.getByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(screen.getByText('unknown-uid')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
