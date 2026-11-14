import { render, screen } from '@testing-library/react';

import { VICTORIA_LOGS_RULES_SOURCE_TYPE } from '@grafana/alerting/internal';
import { type RulesSource } from 'app/types/unified-alerting';

import { mockDataSource } from '../testSetup/mockDataSource';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { Expression } from './Expression';

const promRulesSource = mockDataSource({ type: DataSourceType.Prometheus });
const lokiRulesSource = mockDataSource({ type: DataSourceType.Loki });
const victoriaLogsRulesSource = mockDataSource({ type: VICTORIA_LOGS_RULES_SOURCE_TYPE });

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

  it('renders VictoriaLogs (LogsQL) queries as plain text instead of applying the PromQL grammar', () => {
    const query = '_time:5m error | stats count() as errors | filter errors:>10';
    render(<Expression expression={query} rulesSource={victoriaLogsRulesSource} />);

    expect(screen.queryByTestId('expression-editor')).not.toBeInTheDocument();
    expect(screen.getByText(query)).toBeInTheDocument();
  });

  it('renders plain text for non-cloud (Grafana-managed) rules', () => {
    const query = 'sum(rate(http_requests_total[5m])) > 0.5';
    const rulesSource: RulesSource = GRAFANA_RULES_SOURCE_NAME;
    render(<Expression expression={query} rulesSource={rulesSource} />);

    expect(screen.queryByTestId('expression-editor')).not.toBeInTheDocument();
    expect(screen.getByText(query)).toBeInTheDocument();
  });
});
