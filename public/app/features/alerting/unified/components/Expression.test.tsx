import { render, screen } from '@testing-library/react';

import { type RulesSource } from 'app/types/unified-alerting';

import { mockDataSource } from '../mocks';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { Expression } from './Expression';

const promRulesSource = mockDataSource({ type: DataSourceType.Prometheus });
const lokiRulesSource = mockDataSource({ type: DataSourceType.Loki });

describe('Expression', () => {
  it('renders a syntax-highlighted PromQL query for Prometheus rules', () => {
    const query = 'sum(rate(http_requests_total[5m])) > 0.5';
    render(<Expression expression={query} rulesSource={promRulesSource} />);

    // Prism wraps recognised syntax in token spans.
    expect(screen.getByTestId('expression-editor').innerHTML).toContain('token');
  });

  it('renders a syntax-highlighted LogQL query for Loki rules', () => {
    const query = 'count_over_time({job="mysql"}[5m]) > 100';
    render(<Expression expression={query} rulesSource={lokiRulesSource} />);

    expect(screen.getByTestId('expression-editor').innerHTML).toContain('token');
  });

  // The displayed query must copy cleanly (no stray characters from an editor). See PR #57839.
  it('preserves the exact query text so it copies cleanly', () => {
    const query = 'sum(rate(http_requests_total[5m])) > 0.5';
    render(<Expression expression={query} rulesSource={promRulesSource} />);

    // Anchored regex asserts the text content is *exactly* the query, with no stray characters.
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expect(screen.getByTestId('expression-editor')).toHaveTextContent(new RegExp(`^${escaped}$`));
  });

  it('renders plain text for non-cloud (Grafana-managed) rules', () => {
    const query = 'sum(rate(http_requests_total[5m])) > 0.5';
    const rulesSource: RulesSource = GRAFANA_RULES_SOURCE_NAME;
    render(<Expression expression={query} rulesSource={rulesSource} />);

    expect(screen.queryByTestId('expression-editor')).not.toBeInTheDocument();
    expect(screen.getByText(query)).toBeInTheDocument();
  });
});
