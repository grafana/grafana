import { render, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { byText, byRole } from 'testing-library-selector';

import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { AccessControlAction } from 'app/types';
import { CombinedRule, RuleIdentifier } from 'app/types/unified-alerting';

import { getCloudRule, getGrafanaRule, grantUserPermissions } from '../../../mocks';
import { Annotation } from '../../../utils/constants';
import * as ruleId from '../../../utils/rule-id';

import { AlertRuleProvider } from './RuleContext';
import RuleViewer from './RuleViewer.v2';
import { createMockGrafanaServer } from './__mocks__/server';

// metadata and interactive elements
const ELEMENTS = {
  loading: byText(/Loading rule/i),
  metadata: {
    summary: (text: string) => byText(text),
    runbook: (url: string) => byRole('link', { name: url }),
    dashboardAndPanel: byRole('link', { name: 'View panel' }),
    evaluationInterval: (interval: string) => byText(`Every ${interval}`),
    label: ([key, value]: [string, string]) => byRole('listitem', { name: `${key}: ${value}` }),
  },
  actions: {
    edit: byRole('link', { name: 'Edit' }),
    more: {
      button: byRole('button', { name: /More/i }),
      actions: {
        silence: byRole('link', { name: /Silence/i }),
        declareIncident: byRole('menuitem', { name: /Declare incident/i }),
        duplicate: byRole('menuitem', { name: /Duplicate/i }),
        copyLink: byRole('menuitem', { name: /Copy link/i }),
        export: byRole('menuitem', { name: /Export/i }),
        delete: byRole('menuitem', { name: /Delete/i }),
      },
    },
  },
};

describe('RuleViewer', () => {
  describe('Grafana managed alert rule', () => {
    const server = createMockGrafanaServer();

    const mockRule = getGrafanaRule(
      {
        name: 'Test alert',
        annotations: {
          [Annotation.dashboardUID]: 'dashboard-1',
          [Annotation.panelID]: 'panel-1',
          [Annotation.summary]: 'This is the summary for the rule',
          [Annotation.runbookURL]: 'https://runbook.site/',
        },
        labels: {
          team: 'operations',
          severity: 'low',
        },
        group: {
          name: 'my-group',
          interval: '15m',
          rules: [],
          totals: { alerting: 1 },
        },
      },
      { uid: 'test1' }
    );
    const mockRuleIdentifier = ruleId.fromCombinedRule('grafana', mockRule);

    beforeAll(() => {
      grantUserPermissions([
        AccessControlAction.AlertingRuleCreate,
        AccessControlAction.AlertingRuleRead,
        AccessControlAction.AlertingRuleUpdate,
        AccessControlAction.AlertingRuleDelete,
        AccessControlAction.AlertingInstanceCreate,
      ]);
      setBackendSrv(backendSrv);
    });

    beforeEach(() => {
      server.listen();
    });

    afterAll(() => {
      server.close();
    });

    afterEach(() => {
      server.resetHandlers();
    });

    it('should render a Grafana managed alert rule', async () => {
      await renderRuleViewer(mockRule, mockRuleIdentifier);

      // assert on basic info to be visible
      expect(screen.getByText('Test alert')).toBeInTheDocument();
      expect(screen.getByText('Firing')).toBeInTheDocument();

      // alert rule metadata
      const ruleSummary = mockRule.annotations[Annotation.summary];
      const runBookURL = mockRule.annotations[Annotation.runbookURL];
      const groupInterval = mockRule.group.interval;
      const labels = mockRule.labels;

      expect(ELEMENTS.metadata.summary(ruleSummary).get()).toBeInTheDocument();
      expect(ELEMENTS.metadata.dashboardAndPanel.get()).toBeInTheDocument();
      expect(ELEMENTS.metadata.runbook(runBookURL).get()).toBeInTheDocument();
      expect(ELEMENTS.metadata.evaluationInterval(groupInterval!).get()).toBeInTheDocument();

      for (const label in labels) {
        expect(ELEMENTS.metadata.label([label, labels[label]]).get()).toBeInTheDocument();
      }

      // actions
      await waitFor(() => {
        expect(ELEMENTS.actions.edit.get()).toBeInTheDocument();
        expect(ELEMENTS.actions.more.button.get()).toBeInTheDocument();
      });

      // check the "more actions" button
      await userEvent.click(ELEMENTS.actions.more.button.get());
      const menuItems = Object.values(ELEMENTS.actions.more.actions);
      for (const menuItem of menuItems) {
        expect(menuItem.get()).toBeInTheDocument();
      }
    });
  });

  describe.skip('Data source managed alert rule', () => {
    const mockRule = getCloudRule({ name: 'cloud test alert' });
    const mockRuleIdentifier = ruleId.fromCombinedRule('mimir-1', mockRule);

    beforeAll(() => {
      grantUserPermissions([
        AccessControlAction.AlertingRuleExternalRead,
        AccessControlAction.AlertingRuleExternalWrite,
      ]);
    });

    it('should render a data source managed alert rule', () => {
      renderRuleViewer(mockRule, mockRuleIdentifier);

      // assert on basic info to be vissible
      expect(screen.getByText('Test alert')).toBeInTheDocument();
      expect(screen.getByText('Firing')).toBeInTheDocument();

      expect(screen.getByText(mockRule.annotations[Annotation.summary])).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'View panel' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: mockRule.annotations[Annotation.runbookURL] })).toBeInTheDocument();
      expect(screen.getByText(`Every ${mockRule.group.interval}`)).toBeInTheDocument();
    });
  });
});

const renderRuleViewer = async (rule: CombinedRule, identifier: RuleIdentifier) => {
  render(
    <AlertRuleProvider identifier={identifier} rule={rule}>
      <RuleViewer />
    </AlertRuleProvider>,
    { wrapper: TestProvider }
  );

  await waitFor(() => expect(ELEMENTS.loading.query()).not.toBeInTheDocument());
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useReturnToPrevious: jest.fn(),
}));
