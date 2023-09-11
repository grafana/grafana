import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { byRole, byText } from 'testing-library-selector';

import { locationService, setBackendSrv } from '@grafana/runtime';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';
import { CombinedRule } from 'app/types/unified-alerting';
import { PromAlertingRuleState, PromApplication } from 'app/types/unified-alerting-dto';

import { discoverFeatures } from '../../api/buildInfo';
import { useIsRuleEditable } from '../../hooks/useIsRuleEditable';
import { mockAlertRuleApi, setupMswServer } from '../../mockApi';
import {
  getCloudRule,
  getGrafanaRule,
  grantUserPermissions,
  mockDataSource,
  mockPromAlertingRule,
  mockRulerAlertingRule,
  promRuleFromRulerRule,
} from '../../mocks';
import { mockAlertmanagerChoiceResponse } from '../../mocks/alertmanagerApi';
import { mockPluginSettings } from '../../mocks/plugins';
import { setupDataSources } from '../../testSetup/datasources';
import { SupportedPlugin } from '../../types/pluginBridges';
import * as ruleId from '../../utils/rule-id';

import { RuleViewer } from './RuleViewer.v1';

const mockGrafanaRule = getGrafanaRule({ name: 'Test alert' }, { uid: 'test1', title: 'Test alert' });
const mockCloudRule = getCloudRule({ name: 'cloud test alert' });

const mockRoute = (id?: string): GrafanaRouteComponentProps<{ id?: string; sourceName?: string }> => ({
  route: {
    path: '/',
    component: RuleViewer,
  },
  queryParams: { returnTo: '/alerting/list' },
  match: { params: { id: id ?? 'test1', sourceName: 'grafana' }, isExact: false, url: 'asdf', path: '' },
  history: locationService.getHistory(),
  location: { pathname: '', hash: '', search: '', state: '' },
  staticContext: {},
});

jest.mock('../../hooks/useIsRuleEditable');
jest.mock('../../api/buildInfo');

const mocks = {
  useIsRuleEditable: jest.mocked(useIsRuleEditable),
};

const ui = {
  actionButtons: {
    edit: byRole('link', { name: /edit/i }),
    clone: byRole('button', { name: /^copy$/i }),
    delete: byRole('button', { name: /delete/i }),
    silence: byRole('link', { name: 'Silence' }),
  },
  loadingIndicator: byText(/Loading rule/i),
};

const renderRuleViewer = async (ruleId?: string) => {
  render(
    <TestProvider>
      <RuleViewer {...mockRoute(ruleId)} />
    </TestProvider>
  );

  await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());
};

const server = setupMswServer();

const dsName = 'prometheus';
const rulerRule = mockRulerAlertingRule({ alert: 'cloud test alert' });
const rulerRuleIdentifier = ruleId.fromRulerRule('prometheus', 'ns-default', 'group-default', rulerRule);

beforeAll(() => {
  setBackendSrv(backendSrv);

  // some action buttons need to check what Alertmanager setup we have for Grafana managed rules
  mockAlertmanagerChoiceResponse(server, {
    alertmanagersChoice: AlertmanagerChoice.Internal,
    numExternalAlertmanagers: 1,
  });
  // we need to mock this one for the "declare incident" button
  mockPluginSettings(server, SupportedPlugin.Incident);

  const promDsSettings = mockDataSource({
    name: dsName,
    uid: dsName,
  });

  setupDataSources(promDsSettings);

  mockAlertRuleApi(server).rulerRules('grafana', {
    [mockGrafanaRule.namespace.name]: [
      { name: mockGrafanaRule.group.name, interval: '1m', rules: [mockGrafanaRule.rulerRule!] },
    ],
  });

  const { name, query, labels, annotations } = mockGrafanaRule;
  mockAlertRuleApi(server).prometheusRuleNamespaces('grafana', {
    data: {
      groups: [
        {
          file: mockGrafanaRule.namespace.name,
          interval: 60,
          name: mockGrafanaRule.group.name,
          rules: [mockPromAlertingRule({ name, query, labels, annotations })],
        },
      ],
    },
    status: 'success',
  });

  mockAlertRuleApi(server).rulerRuleGroup(dsName, 'ns-default', 'group-default', {
    name: 'group-default',
    interval: '1m',
    rules: [rulerRule],
  });

  mockAlertRuleApi(server).prometheusRuleNamespaces(dsName, {
    data: {
      groups: [
        {
          file: 'ns-default',
          interval: 60,
          name: 'group-default',
          rules: [promRuleFromRulerRule(rulerRule, { state: PromAlertingRuleState.Inactive })],
        },
      ],
    },
    status: 'success',
  });
});

describe('RuleViewer', () => {
  let mockCombinedRule = jest.fn();

  afterEach(() => {
    mockCombinedRule.mockReset();
  });

  it('should render page with grafana alert', async () => {
    mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: false });
    await renderRuleViewer();

    expect(screen.getByText(/test alert/i)).toBeInTheDocument();
  });

  it('should render page with cloud alert', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    jest
      .mocked(discoverFeatures)
      .mockResolvedValue({ application: PromApplication.Mimir, features: { rulerApiEnabled: true } });

    mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: false });
    await renderRuleViewer(ruleId.stringifyIdentifier(rulerRuleIdentifier));

    expect(screen.getByText(/cloud test alert/i)).toBeInTheDocument();
  });
});

describe('RuleDetails RBAC', () => {
  describe('Grafana rules action buttons in details', () => {
    let mockCombinedRule = jest.fn();

    beforeEach(() => {
      // mockCombinedRule = jest.mocked(useCombinedRule);
    });

    afterEach(() => {
      mockCombinedRule.mockReset();
    });
    it('Should render Edit button for users with the update permission', async () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: true });
      mockCombinedRule.mockReturnValue({
        result: mockGrafanaRule as CombinedRule,
        loading: false,
        dispatched: true,
        requestId: 'A',
        error: undefined,
      });

      // Act
      await renderRuleViewer();

      // Assert
      expect(ui.actionButtons.edit.get()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', async () => {
      // Arrange
      mockCombinedRule.mockReturnValue({
        result: mockGrafanaRule as CombinedRule,
        loading: false,
        dispatched: true,
        requestId: 'A',
        error: undefined,
      });
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: true });

      // Act
      await renderRuleViewer();

      // Assert
      expect(ui.actionButtons.delete.get()).toBeInTheDocument();
    });

    it('Should not render Silence button for users wihout the instance create permission', async () => {
      // Arrange
      mockCombinedRule.mockReturnValue({
        result: mockGrafanaRule as CombinedRule,
        loading: false,
        dispatched: true,
        requestId: 'A',
        error: undefined,
      });
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

      // Act
      await renderRuleViewer();

      // Assert
      await waitFor(() => {
        expect(ui.actionButtons.silence.query()).not.toBeInTheDocument();
      });
    });

    it('Should render Silence button for users with the instance create permissions', async () => {
      // Arrange
      mockCombinedRule.mockReturnValue({
        result: mockGrafanaRule as CombinedRule,
        loading: false,
        dispatched: true,
        requestId: 'A',
        error: undefined,
      });
      jest
        .spyOn(contextSrv, 'hasPermission')
        .mockImplementation((action) => action === AccessControlAction.AlertingInstanceCreate);

      // Act
      await renderRuleViewer();

      // Assert
      await waitFor(() => {
        expect(ui.actionButtons.silence.query()).toBeInTheDocument();
      });
    });

    it('Should render clone button for users having create rule permission', async () => {
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: false });
      mockCombinedRule.mockReturnValue({
        result: getGrafanaRule({ name: 'Grafana rule' }),
        loading: false,
        dispatched: true,
      });
      grantUserPermissions([AccessControlAction.AlertingRuleCreate]);

      await renderRuleViewer();

      expect(ui.actionButtons.clone.get()).toBeInTheDocument();
    });

    it('Should NOT render clone button for users without create rule permission', async () => {
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: true });
      mockCombinedRule.mockReturnValue({
        result: getGrafanaRule({ name: 'Grafana rule' }),
        loading: false,
        dispatched: true,
      });

      const { AlertingRuleRead, AlertingRuleUpdate, AlertingRuleDelete } = AccessControlAction;
      grantUserPermissions([AlertingRuleRead, AlertingRuleUpdate, AlertingRuleDelete]);

      await renderRuleViewer();

      expect(ui.actionButtons.clone.query()).not.toBeInTheDocument();
    });
  });
  describe('Cloud rules action buttons', () => {
    let mockCombinedRule = jest.fn();

    beforeEach(() => {
      // mockCombinedRule = jest.mocked(useCombinedRule);
    });

    afterEach(() => {
      mockCombinedRule.mockReset();
    });
    it('Should render edit button for users with the update permission', async () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: true });
      mockCombinedRule.mockReturnValue({
        result: mockCloudRule as CombinedRule,
        loading: false,
        dispatched: true,
        requestId: 'A',
        error: undefined,
      });

      // Act
      await renderRuleViewer();

      // Assert
      expect(ui.actionButtons.edit.query()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', async () => {
      // Arrange
      mockCombinedRule.mockReturnValue({
        result: mockCloudRule as CombinedRule,
        loading: false,
        dispatched: true,
        requestId: 'A',
        error: undefined,
      });
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: true });

      // Act
      await renderRuleViewer();

      // Assert
      expect(ui.actionButtons.delete.query()).toBeInTheDocument();
    });
  });
});
