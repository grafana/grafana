import { act, render, screen } from 'test/test-utils';

import { getDataSourceInstanceList } from '@grafana/runtime';
import { setDataSourceInstanceSettings } from '@grafana/runtime/internal';
import { ExpressionDatasourceUID } from 'app/features/expressions/types';

import { getCloudRule, getGrafanaRule, mockAlertQuery, mockDataSource } from '../../mocks';

import { RuleDetailsDataSources } from './RuleDetailsDataSources';

function setDataSources(...dataSources: Array<ReturnType<typeof mockDataSource>>) {
  setDataSourceInstanceSettings(Object.fromEntries(dataSources.map((ds) => [ds.name, ds])));
}

function grafanaRuleQuerying(...uids: string[]) {
  return getGrafanaRule(undefined, {
    data: uids.map((uid, index) => mockAlertQuery({ refId: String.fromCharCode(65 + index), datasourceUid: uid })),
  });
}

afterEach(() => {
  setDataSourceInstanceSettings({});
});

describe('RuleDetailsDataSources', () => {
  it('lists each data source of a Grafana rule once, without expressions', async () => {
    setDataSources(mockDataSource({ uid: 'prom', name: 'Prometheus' }));
    const rule = grafanaRuleQuerying('prom', 'prom', ExpressionDatasourceUID);

    render(<RuleDetailsDataSources rule={rule} rulesSource={rule.namespace.rulesSource} />);

    expect(await screen.findByText('Prometheus')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'Prometheus datasource logo' })).toBeInTheDocument();
  });

  it('lists the data sources of a Grafana rule in query order', async () => {
    setDataSources(mockDataSource({ uid: 'a', name: 'Alpha' }), mockDataSource({ uid: 'b', name: 'Beta' }));
    const rule = grafanaRuleQuerying('b', 'a');

    render(<RuleDetailsDataSources rule={rule} rulesSource={rule.namespace.rulesSource} />);

    expect(await screen.findByText('Beta')).toBeInTheDocument();
    expect(screen.getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual([
      'Beta datasource logo',
      'Alpha datasource logo',
    ]);
  });

  it('leaves out data sources that do not resolve', async () => {
    setDataSources(mockDataSource({ uid: 'prom', name: 'Prometheus' }));
    const rule = grafanaRuleQuerying('missing', 'prom');

    render(<RuleDetailsDataSources rule={rule} rulesSource={rule.namespace.rulesSource} />);

    expect(await screen.findByText('Prometheus')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });

  it('renders nothing until the data source list loads', async () => {
    setDataSources(mockDataSource({ uid: 'prom', name: 'Prometheus' }));
    const rule = grafanaRuleQuerying('prom');

    const { container } = render(<RuleDetailsDataSources rule={rule} rulesSource={rule.namespace.rulesSource} />);

    expect(container).toBeEmptyDOMElement();
    expect(await screen.findByText('Prometheus')).toBeInTheDocument();
  });

  it('renders nothing when no data source resolves', async () => {
    setDataSources(mockDataSource({ uid: 'prom', name: 'Prometheus' }));
    const rule = grafanaRuleQuerying('missing');

    const { container } = render(<RuleDetailsDataSources rule={rule} rulesSource={rule.namespace.rulesSource} />);
    await act(() => getDataSourceInstanceList({ all: true }));

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the rules source of a cloud rule', async () => {
    const rulesSource = mockDataSource({ uid: 'mimir', name: 'Mimir' });
    const rule = getCloudRule(undefined, { rulesSource });

    render(<RuleDetailsDataSources rule={rule} rulesSource={rulesSource} />);

    expect(await screen.findByText('Mimir')).toBeInTheDocument();
  });
});
