import { UserEvent } from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { ReactNode } from 'react';
import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { screen, testWithFeatureToggles, waitFor, within } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setPluginLinksHook } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions, mockDataSource, mockFolder } from 'app/features/alerting/unified/mocks';
import {
  grafanaRulerGroup,
  grafanaRulerNamespace,
  grafanaRulerRule,
  mockPreviewApiResponse,
} from 'app/features/alerting/unified/mocks/grafanaRulerApi';
import { setAlertmanagerChoices, setFolderResponse } from 'app/features/alerting/unified/mocks/server/configure';
import { PROMETHEUS_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { captureRequests, serializeRequests } from 'app/features/alerting/unified/mocks/server/events';
import { FOLDER_TITLE_HAPPY_PATH } from 'app/features/alerting/unified/mocks/server/handlers/search';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import { MANUAL_ROUTING_KEY } from 'app/features/alerting/unified/utils/rule-form';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import { RulerGrafanaRuleDTO, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { NAMED_ROOT_LABEL_NAME } from '../../notification-policies/useNotificationPolicyRoute';

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: ReactNode }) => <div>{actions}</div>,
}));

jest.setTimeout(90 * 1000);

const dataSources = {
  default: mockDataSource(
    {
      type: 'prometheus',
      name: 'Prom',
      uid: PROMETHEUS_DATASOURCE_UID,
      isDefault: true,
    },
    { alerting: true, module: 'core:plugin/prometheus' }
  ),
  am: mockDataSource({
    name: 'Alertmanager',
    type: DataSourceType.Alertmanager,
  }),
};

const policyTreeUi = {
  policySelector: byRole('combobox', { name: /select notification policy/i }),
  policyTitle: byRole('heading', { name: /notification policy/i }),
  viewPoliciesLink: byRole('link', { name: /view notification policies/i }),
};

const selectFolderAndGroup = async (user: UserEvent) => {
  const folderPicker = ui.inputs.folder.get();
  const folderButton = await within(folderPicker).findByRole('button', { name: /select folder/i });
  await user.click(folderButton);

  const folderOption = await within(folderPicker).findByLabelText(FOLDER_TITLE_HAPPY_PATH);
  await user.click(folderOption);

  const groupInput = await ui.inputs.group.find();
  const groupCombobox = await byRole('combobox').find(groupInput);
  await user.click(groupCombobox);
  await clickSelectOption(groupInput, grafanaRulerGroup.name);
};

const server = setupMswServer();

beforeEach(() => {
  const mockGetBoundingClientRect = jest.fn(() => ({
    width: 120,
    height: 120,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  }));

  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    value: mockGetBoundingClientRect,
  });

  mockPreviewApiResponse(server, []);
});

setupDataSources(dataSources.default, dataSources.am);
setPluginLinksHook(() => ({ links: [], isLoading: false }));

afterEach(() => {
  window.localStorage.clear();
});

const grantAllPermissions = () => {
  grantUserPermissions([
    AccessControlAction.AlertingRuleRead,
    AccessControlAction.AlertingRuleUpdate,
    AccessControlAction.AlertingRuleDelete,
    AccessControlAction.AlertingRuleCreate,
    AccessControlAction.DataSourcesRead,
    AccessControlAction.DataSourcesWrite,
    AccessControlAction.DataSourcesCreate,
    AccessControlAction.FoldersWrite,
    AccessControlAction.FoldersRead,
    AccessControlAction.AlertingRuleExternalRead,
    AccessControlAction.AlertingRuleExternalWrite,
    AccessControlAction.AlertingNotificationsRead,
    AccessControlAction.AlertingNotificationsWrite,
  ]);
};

describe('PolicyTreeSelector - feature toggle OFF', () => {
  beforeEach(() => {
    localStorage.setItem(MANUAL_ROUTING_KEY, 'false');
    contextSrv.isEditor = true;
    contextSrv.hasEditPermissionInFolders = true;
    setAlertmanagerChoices(AlertmanagerChoice.Internal, 1);
    grantAllPermissions();
  });

  it('does not show policy tree selector when feature toggle is disabled', async () => {
    const { user } = renderRuleEditor();

    await user.type(await ui.inputs.name.find(), 'my great new rule');
    await selectFolderAndGroup(user);

    // Wait for the form to be fully loaded
    await waitFor(() => {
      expect(ui.buttons.save.get()).toBeEnabled();
    });

    // Should NOT show the policy selector
    expect(policyTreeUi.policySelector.query()).not.toBeInTheDocument();
    expect(policyTreeUi.policyTitle.query()).not.toBeInTheDocument();
  });
});

describe('PolicyTreeSelector - feature toggle ON', () => {
  testWithFeatureToggles({ enable: ['alertingMultiplePolicies'] });

  beforeEach(() => {
    localStorage.setItem(MANUAL_ROUTING_KEY, 'false');
    contextSrv.isEditor = true;
    contextSrv.hasEditPermissionInFolders = true;
    setAlertmanagerChoices(AlertmanagerChoice.Internal, 1);
    grantAllPermissions();
  });

  it('shows policy tree selector with title, dropdown, and link', async () => {
    const { user } = renderRuleEditor();

    await user.type(await ui.inputs.name.find(), 'my great new rule');
    await selectFolderAndGroup(user);

    // Policy tree selector should be visible
    await waitFor(() => {
      expect(policyTreeUi.policyTitle.get()).toBeInTheDocument();
    });

    expect(policyTreeUi.policySelector.get()).toBeInTheDocument();
    expect(policyTreeUi.viewPoliciesLink.get()).toBeInTheDocument();
    expect(policyTreeUi.viewPoliciesLink.get()).toHaveAttribute('href', '/alerting/routes');
  });

  it('defaults to Default policy for new rules', async () => {
    const { user } = renderRuleEditor();

    await user.type(await ui.inputs.name.find(), 'my great new rule');
    await selectFolderAndGroup(user);

    await waitFor(() => {
      expect(policyTreeUi.policySelector.get()).toBeEnabled();
    });

    // Should show "Default policy" as the selected value
    expect(screen.getByText('Default policy')).toBeInTheDocument();
  });

  it('does not add __grafana_managed_route__ label when default policy is selected', async () => {
    const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));

    const { user } = renderRuleEditor();

    await user.type(await ui.inputs.name.find(), 'my great new rule');
    await selectFolderAndGroup(user);

    await waitFor(() => {
      expect(policyTreeUi.policySelector.get()).toBeEnabled();
    });

    // Default policy is already selected, just save
    await user.click(ui.buttons.save.get());
    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);

    // The request should NOT contain __grafana_managed_route__ label
    expect(serializedRequests).toMatchSnapshot();
  });

  it('adds __grafana_managed_route__ label when custom policy is selected', async () => {
    const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));

    const { user } = renderRuleEditor();

    await user.type(await ui.inputs.name.find(), 'my great new rule');
    await selectFolderAndGroup(user);

    await waitFor(() => {
      expect(policyTreeUi.policySelector.get()).toBeEnabled();
    });

    // Open the policy dropdown
    await user.click(policyTreeUi.policySelector.get());

    // Wait for options to load
    await waitFor(() => {
      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(1);
    });

    // Select a non-default policy (Managed Policy - Empty Provisioned)
    const customPolicyName = 'Managed Policy - Empty Provisioned';
    const customPolicyOption = screen.getByRole('option', { name: new RegExp(customPolicyName, 'i') });
    expect(customPolicyOption).toBeInTheDocument();
    await user.click(customPolicyOption);

    // Verify the policy was selected
    await waitFor(() => {
      expect(screen.getByText(customPolicyName)).toBeInTheDocument();
    });

    // Save
    await user.click(ui.buttons.save.get());
    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);

    // The request should contain __grafana_managed_route__ label with the policy name
    expect(serializedRequests).toMatchSnapshot();
  });

  describe('edit existing rule', () => {
    const CUSTOM_POLICY_NAME = 'Managed Policy - Empty Provisioned';

    // Setup folder with edit permissions
    beforeEach(() => {
      setFolderResponse(
        mockFolder({
          uid: grafanaRulerNamespace.uid,
          title: grafanaRulerNamespace.name,
          accessControl: {
            [AccessControlAction.AlertingRuleUpdate]: true,
          },
        })
      );
    });

    const mockRulerGroupWithLabels = (labels: Record<string, string>) => {
      const ruleWithLabels: RulerGrafanaRuleDTO = {
        ...grafanaRulerRule,
        labels: {
          ...grafanaRulerRule.labels,
          ...labels,
        },
      };

      const group: RulerRuleGroupDTO<RulerGrafanaRuleDTO> = {
        ...grafanaRulerGroup,
        rules: [ruleWithLabels],
      };

      server.use(
        http.get(`/api/ruler/grafana/api/v1/rules/${grafanaRulerNamespace.uid}/${grafanaRulerGroup.name}`, () =>
          HttpResponse.json(group)
        )
      );
    };

    it('pre-selects the policy from existing __grafana_managed_route__ label', async () => {
      mockRulerGroupWithLabels({ [NAMED_ROOT_LABEL_NAME]: CUSTOM_POLICY_NAME });

      // Use just the UID like other tests do
      renderRuleEditor(grafanaRulerRule.grafana_alert.uid);

      // Wait for the form to load
      await waitFor(() => {
        expect(policyTreeUi.policySelector.get()).toBeEnabled();
      });

      // Should show the custom policy name as selected
      expect(screen.getByText(CUSTOM_POLICY_NAME)).toBeInTheDocument();
    });

    it('pre-selects Default policy when rule has no __grafana_managed_route__ label', async () => {
      mockRulerGroupWithLabels({}); // no policy label

      // Use just the UID like other tests do
      renderRuleEditor(grafanaRulerRule.grafana_alert.uid);

      // Wait for the form to load
      await waitFor(() => {
        expect(policyTreeUi.policySelector.get()).toBeEnabled();
      });

      // Should show Default policy as selected
      expect(screen.getByText('Default policy')).toBeInTheDocument();
    });
  });
});
