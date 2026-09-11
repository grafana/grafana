import { render, screen, waitFor } from 'test/test-utils';

import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';

import { mockAlertQuery, mockCombinedRule, mockDataSource, mockRulerGrafanaRule } from '../../mocks';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { RuleDetailsDataSources } from './RuleDetailsDataSources';

describe('RuleDetailsDataSources', () => {
  it('resolves data source names from the data source list for Grafana-managed rules', async () => {
    const prometheus = mockDataSource({ uid: 'prom-1', name: 'prometheus' });
    setupDataSources(prometheus);

    const rule = mockCombinedRule({
      rulerRule: mockRulerGrafanaRule(undefined, {
        data: [mockAlertQuery({ datasourceUid: prometheus.uid })],
      }),
    });

    render(<RuleDetailsDataSources rule={rule} rulesSource={GRAFANA_RULES_SOURCE_NAME} />);

    await waitFor(() => {
      expect(screen.getByText('prometheus')).toBeInTheDocument();
    });
  });

  it('deduplicates queries that target the same data source', async () => {
    const prometheus = mockDataSource({ uid: 'prom-1', name: 'prometheus' });
    setupDataSources(prometheus);

    const rule = mockCombinedRule({
      rulerRule: mockRulerGrafanaRule(undefined, {
        data: [
          mockAlertQuery({ refId: 'A', datasourceUid: prometheus.uid }),
          mockAlertQuery({ refId: 'B', datasourceUid: prometheus.uid }),
        ],
      }),
    });

    render(<RuleDetailsDataSources rule={rule} rulesSource={GRAFANA_RULES_SOURCE_NAME} />);

    await waitFor(() => {
      expect(screen.getAllByText('prometheus')).toHaveLength(1);
    });
  });

  it('renders nothing when the rule has no data sources to show', async () => {
    setupDataSources();

    const rule = mockCombinedRule({
      rulerRule: mockRulerGrafanaRule(undefined, { data: [] }),
    });

    const { container } = render(<RuleDetailsDataSources rule={rule} rulesSource={GRAFANA_RULES_SOURCE_NAME} />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
