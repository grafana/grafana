import { render, waitFor } from 'test/test-utils';

import { reportInteraction } from '@grafana/runtime';
import { type PrometheusRuleIdentifier } from 'app/types/unified-alerting';

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
});
