import { Route, Routes, useLocation } from 'react-router-dom-v5-compat';
import { render, screen, waitFor } from 'test/test-utils';

import { reportInteraction } from '@grafana/runtime';
import { type PrometheusRuleIdentifier } from 'app/types/unified-alerting';

import { mockDataSource } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';

import { PluginRuleRedirect } from './PluginRuleRedirect';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const reportInteractionMock = jest.mocked(reportInteraction);

const identifier: PrometheusRuleIdentifier = {
  ruleSourceName: 'Prometheus',
  namespace: 'namespace',
  groupName: 'group',
  ruleName: 'rule',
  ruleHash: 'hash',
};

describe('PluginRuleRedirect', () => {
  beforeEach(() => {
    setupDataSources(mockDataSource({ name: identifier.ruleSourceName, uid: 'prometheus-uid' }));
    reportInteractionMock.mockClear();
  });

  it('tracks redirects to the Prometheus Alerting plugin', async () => {
    render(<PluginRuleRedirect identifier={identifier} action="edit" />);

    await waitFor(() =>
      expect(reportInteractionMock).toHaveBeenCalledWith('grafana_alerting_prometheus_alerting_plugin_redirect', {
        action: 'edit',
      })
    );
  });

  it('preserves returnTo and the active tab when redirecting a rule view', async () => {
    renderRedirect('view', '/alerting/rule/view?tab=instances&returnTo=%2Falerting%2Flist');

    const search = new URLSearchParams(await destinationSearch());
    expect(search.get('returnTo')).toBe('/alerting/list');
    expect(search.get('tab')).toBe('instances');
  });

  it('preserves returnTo when redirecting a clone without double-encoding the identifier', async () => {
    renderRedirect('clone', '/alerting/rule/edit?returnTo=%2Falerting%2Flist');

    const search = new URLSearchParams(await destinationSearch());
    expect(search.get('returnTo')).toBe('/alerting/list');
    expect(search.get('copyFrom')).toBe('pri$prometheus-uid$namespace$group$rule$hash');
  });

  it('drops a returnTo that points outside Grafana', async () => {
    renderRedirect('edit', '/alerting/rule/edit?returnTo=https%3A%2F%2Fexample.com');

    expect(await destinationSearch()).toBe('');
  });
});

function Destination() {
  const location = useLocation();

  return <div data-testid="destination">{location.search}</div>;
}

function renderRedirect(action: 'view' | 'edit' | 'clone', entry: string) {
  return render(
    <Routes>
      <Route path="/alerting/rule/:action" element={<PluginRuleRedirect identifier={identifier} action={action} />} />
      <Route path="*" element={<Destination />} />
    </Routes>,
    { historyOptions: { initialEntries: [entry] } }
  );
}

async function destinationSearch() {
  return (await screen.findByTestId('destination')).textContent ?? '';
}
