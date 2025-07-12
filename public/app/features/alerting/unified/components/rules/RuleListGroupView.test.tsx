import { waitFor } from '@testing-library/react';
import { render } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setPluginLinksHook } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { CombinedRuleNamespace } from 'app/types/unified-alerting';

import * as analytics from '../../Analytics';
import { setupMswServer } from '../../mockApi';
import { mockCombinedRule } from '../../mocks';
import { mimirDataSource } from '../../mocks/server/configure';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { RuleListGroupView } from './RuleListGroupView';

jest.spyOn(analytics, 'logInfo');

const ui = {
  grafanaRulesHeading: byRole('heading', { name: 'Grafana-managed' }),
  cloudRulesHeading: byRole('heading', { name: 'Data source-managed' }),
};

setPluginLinksHook(() => ({
  links: [],
  isLoading: false,
}));

setupMswServer();
const mimirDs = mimirDataSource();

describe('RuleListGroupView', () => {
  describe('RBAC', () => {
    it('Should display Grafana rules when the user has the alert rule read permission', async () => {
      const grafanaNamespace = getGrafanaNamespace();
      const namespaces: CombinedRuleNamespace[] = [grafanaNamespace];

      jest
        .spyOn(contextSrv, 'hasPermission')
        .mockImplementation((action) => action === AccessControlAction.AlertingRuleRead);

      renderRuleList(namespaces);

      await waitFor(() => {
        expect(ui.grafanaRulesHeading.get()).toBeInTheDocument();
      });
    });

    it('Should display Cloud rules when the user has the external rules read permission', async () => {
      const cloudNamespace = getCloudNamespace();
      const namespaces: CombinedRuleNamespace[] = [cloudNamespace];

      jest
        .spyOn(contextSrv, 'hasPermission')
        .mockImplementation((action) => action === AccessControlAction.AlertingRuleExternalRead);

      renderRuleList(namespaces);

      await waitFor(() => {
        expect(ui.cloudRulesHeading.get()).toBeInTheDocument();
      });
    });

    it('Should not display Grafana rules when the user does not have alert rule read permission', async () => {
      const grafanaNamespace = getGrafanaNamespace();
      const namespaces: CombinedRuleNamespace[] = [grafanaNamespace];

      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

      renderRuleList(namespaces);

      await waitFor(() => {
        expect(ui.grafanaRulesHeading.query()).not.toBeInTheDocument();
      });
    });

    it('Should not display Cloud rules when the user does not have the external rules read permission', async () => {
      const cloudNamespace = getCloudNamespace();

      const namespaces: CombinedRuleNamespace[] = [cloudNamespace];
      renderRuleList(namespaces);

      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

      renderRuleList(namespaces);

      await waitFor(() => {
        expect(ui.cloudRulesHeading.query()).not.toBeInTheDocument();
      });
    });
  });

  describe('Analytics', () => {
    it('Sends log info when the list is loaded', () => {
      const grafanaNamespace = getGrafanaNamespace();
      const namespaces: CombinedRuleNamespace[] = [grafanaNamespace];

      renderRuleList(namespaces);

      expect(analytics.logInfo).toHaveBeenCalledWith(analytics.LogMessages.loadedList);
    });
  });
});

function renderRuleList(namespaces: CombinedRuleNamespace[]) {
  render(<RuleListGroupView namespaces={namespaces} expandAll />);
}

function getGrafanaNamespace(): CombinedRuleNamespace {
  return {
    name: 'Grafana Test Namespace',
    rulesSource: GRAFANA_RULES_SOURCE_NAME,
    groups: [
      {
        name: 'default',
        rules: [mockCombinedRule()],
        totals: {},
      },
    ],
  };
}

function getCloudNamespace(): CombinedRuleNamespace {
  return {
    name: 'Cloud Test Namespace',
    rulesSource: mimirDs.dataSource,
    groups: [
      {
        name: 'Prom group',
        rules: [mockCombinedRule()],
        totals: {},
      },
    ],
  };
}
