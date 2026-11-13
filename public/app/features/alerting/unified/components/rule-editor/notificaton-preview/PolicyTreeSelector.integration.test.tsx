import { type UserEvent } from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { type ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';
import { render, screen, testWithFeatureToggles, waitFor, within } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { type DataSourceApi, DataSourcePlugin } from '@grafana/data';
import { config, setPluginLinksHook } from '@grafana/runtime';
import { setDataSourcePluginImporter } from '@grafana/runtime/internal';
import { mockComboboxRect } from '@grafana/test-utils';
import { contextSrv } from 'app/core/services/context_srv';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import {
  grantUserPermissions,
  mockAlertmanagerAlert,
  mockDataSource,
  mockFolder,
} from 'app/features/alerting/unified/mocks';
import {
  grafanaRulerGroup,
  grafanaRulerNamespace,
  grafanaRulerRule,
  mockPreviewApiResponse,
} from 'app/features/alerting/unified/mocks/grafanaRulerApi';
import { setAlertmanagerChoices, setFolderResponse } from 'app/features/alerting/unified/mocks/server/configure';
import { PROMETHEUS_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';
import { FOLDER_TITLE_HAPPY_PATH } from 'app/features/alerting/unified/mocks/server/handlers/folders';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import { MANUAL_ROUTING_KEY } from 'app/features/alerting/unified/utils/rule-form';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import { type RulerGrafanaRuleDTO, type RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { type RuleFormValues } from '../../../types/rule-form';
import { NAMED_ROOT_LABEL_NAME } from '../../notification-policies/useNotificationPolicyRoute';

import { PolicyTreeSelector } from './PolicyTreeSelector';

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: ReactNode }) => <div>{actions}</div>,
}));

jest.mock('app/features/alerting/unified/useRouteGroupsMatcher');

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

function PolicyTreeSelectorHarness() {
  const formApi = useForm<RuleFormValues>({
    defaultValues: { selectedPolicy: '', labels: [] },
  });

  return (
    <FormProvider {...formApi}>
      <PolicyTreeSelector />
    </FormProvider>
  );
}

const policyTreeUi = {
  // Collapsed state
  defaultBadge: byText('Default policy'),
  changeButton: byRole('button', { name: /change notification policy/i }),
  viewPoliciesLink: byRole('link', { name: /view notification policies/i }),

  // Expanded state
  policySelector: byRole('combobox', { name: /select notification policy/i }),
  missingPolicyWarning: byText(/this policy tree is not in your list/i),
};

/** Opens the policy dropdown and picks the option whose label matches `name`. */
const selectPolicyOption = async (user: UserEvent, name: RegExp) => {
  await user.click(policyTreeUi.policySelector.get(ui.formSteps.notification.get()));
  await user.click(await screen.findByRole('option', { name }));
};

const selectFolderAndGroup = async (user: UserEvent) => {
  const folderPicker = ui.inputs.folder.get();
  const folderButton = await within(folderPicker).findByRole('button', { name: /select folder/i });
  await user.click(folderButton);

  const folderOption = await within(folderPicker).findByLabelText(FOLDER_TITLE_HAPPY_PATH);
  await user.click(folderOption);

  await user.click(await ui.inputs.evaluationMode.useGroups.find(await ui.formSteps.evaluation.find()));

  const groupInput = await ui.inputs.group.find();
  const groupCombobox = await byRole('combobox').find(groupInput);
  await user.click(groupCombobox);
  await clickSelectOption(groupInput, grafanaRulerGroup.name);
};

const server = setupMswServer();

beforeEach(() => {
  setupDataSources(dataSources.default, dataSources.am);
  // The rule editor loads query data sources, but these policy tests do not load plugin bundles.
  setDataSourcePluginImporter(async () => new DataSourcePlugin<DataSourceApi>(MockDataSourceApi));
  mockComboboxRect();

  mockPreviewApiResponse(server, []);
});

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

describe('PolicyTreeSelector', () => {
  testWithFeatureToggles({ enable: ['alerting.rulesAPIV2'] });

  beforeEach(() => {
    localStorage.setItem(MANUAL_ROUTING_KEY, 'false');
    contextSrv.isEditor = true;
    contextSrv.hasEditPermissionInFolders = true;
    setAlertmanagerChoices(AlertmanagerChoice.Internal, 1);
    grantAllPermissions();
  });

  describe('new rule - collapsed default policy view', () => {
    describe('when Grafana is served from a sub path', () => {
      const originalSubUrl = config.appSubUrl;

      beforeEach(() => {
        config.appSubUrl = '/grafana';
      });

      afterEach(() => {
        config.appSubUrl = originalSubUrl;
      });

      it('prefixes the View policies link with the sub path', async () => {
        const { user, container } = render(<PolicyTreeSelectorHarness />, { preloadedState: {} });

        expect(await policyTreeUi.viewPoliciesLink.find(container)).toHaveAttribute('href', '/grafana/alerting/routes');

        const changeButton = policyTreeUi.changeButton.get(container);
        await waitFor(() => expect(changeButton).toBeEnabled());
        await user.click(changeButton);

        expect(await policyTreeUi.policySelector.find(container)).toHaveValue('Default policy');
        expect(policyTreeUi.viewPoliciesLink.get(container)).toHaveAttribute('href', '/grafana/alerting/routes');
      });
    });

    it('shows the collapsed default policy and saves without a policy override or legacy label', async () => {
      const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));

      const { user } = renderRuleEditor();

      await user.type(await ui.inputs.name.find(), 'my great new rule');
      await selectFolderAndGroup(user);

      const notificationStep = await ui.formSteps.notification.find();
      // Wait for the collapsed policy section
      expect(await policyTreeUi.defaultBadge.find(notificationStep)).toBeInTheDocument();

      // Collapsed state: badge + change button, NO dropdown
      expect(policyTreeUi.changeButton.get(notificationStep)).toBeInTheDocument();
      expect(policyTreeUi.viewPoliciesLink.get(notificationStep)).toBeInTheDocument();
      expect(policyTreeUi.viewPoliciesLink.get(notificationStep)).toHaveAttribute('href', '/alerting/routes');

      // Dropdown should NOT be visible in collapsed state
      expect(policyTreeUi.policySelector.query(notificationStep)).not.toBeInTheDocument();

      // Save without changing policy
      await user.click(ui.buttons.save.get());
      const requests = await capture;
      const bodies = await Promise.all(
        requests.map((r) => r.json() as Promise<RulerRuleGroupDTO<RulerGrafanaRuleDTO>>)
      );
      const ruleBody = bodies[0];
      const newRule = ruleBody.rules[ruleBody.rules.length - 1];

      expect(newRule.grafana_alert.notification_settings).toBeUndefined();
      expect(newRule.labels?.[NAMED_ROOT_LABEL_NAME]).toBeUndefined();
    });

    it('expands the default selection and saves a custom policy without a legacy label', async () => {
      const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));

      const { user } = renderRuleEditor();

      await user.type(await ui.inputs.name.find(), 'my great new rule');
      await selectFolderAndGroup(user);

      const notificationStep = await ui.formSteps.notification.find();
      // Wait for collapsed state
      await waitFor(() => {
        expect(policyTreeUi.changeButton.get(notificationStep)).toBeEnabled();
      });

      // Click "Change" to expand
      await user.click(policyTreeUi.changeButton.get(notificationStep));

      // Now the dropdown should be visible
      await waitFor(() => {
        expect(policyTreeUi.policySelector.get(notificationStep)).toBeInTheDocument();
      });

      // Change button should be gone
      expect(policyTreeUi.changeButton.query(notificationStep)).not.toBeInTheDocument();

      // The dropdown should show "Default policy" as selected, not blank
      expect(within(notificationStep).getByDisplayValue(/default policy/i)).toBeInTheDocument();

      // Open the policy dropdown
      await user.click(policyTreeUi.policySelector.get(notificationStep));

      // Wait for options to load
      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options.length).toBeGreaterThan(1);
      });

      // Select a non-default policy
      const customPolicyName = 'Managed Policy - Empty Provisioned';
      const customPolicyOption = screen.getByRole('option', { name: new RegExp(customPolicyName, 'i') });
      await user.click(customPolicyOption);

      // Verify the policy was selected
      await waitFor(() => {
        expect(within(notificationStep).getByDisplayValue(customPolicyName)).toBeInTheDocument();
      });

      // Save
      await user.click(ui.buttons.save.get());
      const requests = await capture;
      const bodies = await Promise.all(
        requests.map((r) => r.json() as Promise<RulerRuleGroupDTO<RulerGrafanaRuleDTO>>)
      );
      const ruleBody = bodies[0];
      const newRule = ruleBody.rules[ruleBody.rules.length - 1];

      // Should use notification_settings.policy, not __grafana_managed_route__ label
      expect(newRule.grafana_alert.notification_settings?.policy).toBe(customPolicyName);
      expect(newRule.grafana_alert.notification_settings?.receiver).toBeUndefined();
      expect(newRule.labels?.[NAMED_ROOT_LABEL_NAME]).toBeUndefined();
    });

    it('collapses back to the default view when Default policy is selected again', async () => {
      const { user, container } = render(<PolicyTreeSelectorHarness />, { preloadedState: {} });
      const customPolicyName = 'Managed Policy - Empty Provisioned';

      const changeButton = await policyTreeUi.changeButton.find(container);
      await waitFor(() => expect(changeButton).toBeEnabled());
      await user.click(changeButton);

      const selector = await policyTreeUi.policySelector.find(container);
      await user.click(selector);
      await user.click(await screen.findByRole('option', { name: new RegExp(customPolicyName, 'i') }));
      await waitFor(() => expect(selector).toHaveValue(customPolicyName));

      await user.click(selector);
      await user.click(await screen.findByRole('option', { name: /default policy/i }));

      expect(await policyTreeUi.defaultBadge.find(container)).toBeInTheDocument();
      expect(policyTreeUi.policySelector.query(container)).not.toBeInTheDocument();

      // Reopening must show the cleared form value, not just a visually collapsed selector.
      await user.click(policyTreeUi.changeButton.get(container));
      expect(await policyTreeUi.policySelector.find(container)).toHaveValue('Default policy');
    });

    it('previews routing through the policy picked after the form loaded', async () => {
      mockPreviewApiResponse(server, [mockAlertmanagerAlert({ labels: { severity: 'critical' } })]);

      const { user } = renderRuleEditor();
      await user.type(await ui.inputs.name.find(), 'my great new rule');
      await selectFolderAndGroup(user);

      const notificationStep = await ui.formSteps.notification.find();
      // The default policy's catch-all route sends the alert to provisioned-contact-point
      await user.click(within(notificationStep).getByRole('button', { name: /preview routing/i }));
      expect(await screen.findByText(/delivered to provisioned-contact-point/i)).toBeInTheDocument();

      // This policy overrides routing for critical alerts
      await user.click(await policyTreeUi.changeButton.find(notificationStep));
      await selectPolicyOption(user, /Managed Policy - Override \+ Inherit/i);
      await user.click(within(notificationStep).getByRole('button', { name: /preview routing/i }));

      expect(await screen.findByText(/delivered to lotsa-emails/i)).toBeInTheDocument();
    });
  });

  // Regression test for bug #1 from PR #124697:
  // AutomaticRooting passed policyName={undefined} to NotificationPreview when a
  // non-default policy tree was selected via the legacy label.
  // The selected tree (stored as __grafana_managed_route__ label) was never forwarded,
  // so routing was always evaluated against the default tree.
  describe('notification preview routing (legacy label rule)', () => {
    const CUSTOM_POLICY_NAME = 'Managed Policy - Override + Inherit';

    beforeEach(() => {
      setFolderResponse(
        mockFolder({
          uid: grafanaRulerNamespace.uid,
          title: grafanaRulerNamespace.name,
          accessControl: {
            [AccessControlAction.AlertingRuleRead]: true,
            [AccessControlAction.AlertingRuleUpdate]: true,
            [AccessControlAction.FoldersRead]: true,
          },
        })
      );

      // Rule uses legacy label-based routing (no notification_settings.policy)
      const ruleWithLabel: RulerGrafanaRuleDTO = {
        ...grafanaRulerRule,
        labels: { [NAMED_ROOT_LABEL_NAME]: CUSTOM_POLICY_NAME },
        grafana_alert: {
          ...grafanaRulerRule.grafana_alert,
          notification_settings: undefined,
        },
      };
      const group: RulerRuleGroupDTO<RulerGrafanaRuleDTO> = {
        ...grafanaRulerGroup,
        rules: [ruleWithLabel],
      };
      server.use(
        http.get(`/api/ruler/grafana/api/v1/rules/${grafanaRulerNamespace.uid}/${grafanaRulerGroup.name}`, () =>
          HttpResponse.json(group)
        )
      );
    });

    it('previews routing through the policy named by the __grafana_managed_route__ label', async () => {
      mockPreviewApiResponse(server, [mockAlertmanagerAlert({ labels: { severity: 'critical' } })]);

      renderRuleEditor(grafanaRulerRule.grafana_alert.uid);

      // The named tree's critical override delivers somewhere the default policy would not.
      expect(await screen.findByText(/delivered to lotsa-emails/i)).toBeInTheDocument();
    });
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
            [AccessControlAction.AlertingRuleRead]: true,
            [AccessControlAction.AlertingRuleUpdate]: true,
            [AccessControlAction.FoldersRead]: true,
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

    it('shows collapsed default view when rule has no __grafana_managed_route__ label', async () => {
      mockRulerGroupWithLabels({}); // no policy label

      renderRuleEditor(grafanaRulerRule.grafana_alert.uid);
      const notificationStep = await ui.formSteps.notification.find();

      // Wait for the form to load - should show collapsed state
      await waitFor(() => {
        expect(policyTreeUi.defaultBadge.get(notificationStep)).toBeInTheDocument();
      });

      // Should show collapsed default view
      expect(policyTreeUi.changeButton.get(notificationStep)).toBeInTheDocument();

      // Dropdown should NOT be visible
      expect(policyTreeUi.policySelector.query(notificationStep)).not.toBeInTheDocument();
    });

    // Regression test: before the fix, selectedPolicy was only migrated from the legacy label
    // while the label itself stayed in form state, so re-opening the selector after resetting
    // could still show (or re-select) the stale label value instead of the default.
    it('pre-selects the legacy policy and clears it on reset without re-selecting the stale label', async () => {
      mockRulerGroupWithLabels({ [NAMED_ROOT_LABEL_NAME]: CUSTOM_POLICY_NAME });

      const { user } = renderRuleEditor(grafanaRulerRule.grafana_alert.uid);
      const notificationStep = await ui.formSteps.notification.find();

      // Wait for the form to load - dropdown should be directly visible (expanded) for custom policy
      await waitFor(() => {
        expect(policyTreeUi.policySelector.get(notificationStep)).toBeEnabled();
      });

      // Should show the custom policy name as selected
      expect(within(notificationStep).getByDisplayValue(CUSTOM_POLICY_NAME)).toBeInTheDocument();
      // Change button should NOT be visible (we're in expanded state)
      expect(policyTreeUi.changeButton.query(notificationStep)).not.toBeInTheDocument();

      // Go back to the default policy, then re-open the selector.
      await selectPolicyOption(user, /default policy/i);
      await waitFor(() => {
        expect(policyTreeUi.changeButton.get(notificationStep)).toBeEnabled();
      });
      await user.click(policyTreeUi.changeButton.get(notificationStep));
      await waitFor(() => {
        expect(policyTreeUi.policySelector.get(notificationStep)).toBeInTheDocument();
      });

      // The selector must reflect the default policy, not the stale legacy label.
      expect(within(notificationStep).queryByDisplayValue(CUSTOM_POLICY_NAME)).not.toBeInTheDocument();
      expect(within(notificationStep).getByDisplayValue(/default policy/i)).toBeInTheDocument();
    });
  });

  // Regression: a rule routed via notification_settings.policy (the canonical, backend-honored
  // storage) was shown as "Default policy" and silently dropped on save when a non-default
  // policy tree was selected, because the selector/save paths only looked at the legacy
  // __grafana_managed_route__ label.
  describe('edit existing rule with notification_settings.policy', () => {
    const CUSTOM_POLICY_NAME = 'Managed Policy - Empty Provisioned';

    beforeEach(() => {
      setFolderResponse(
        mockFolder({
          uid: grafanaRulerNamespace.uid,
          title: grafanaRulerNamespace.name,
          accessControl: {
            [AccessControlAction.AlertingRuleRead]: true,
            [AccessControlAction.AlertingRuleUpdate]: true,
            [AccessControlAction.FoldersRead]: true,
          },
        })
      );

      const ruleWithPolicy: RulerGrafanaRuleDTO = {
        ...grafanaRulerRule,
        labels: {},
        grafana_alert: {
          ...grafanaRulerRule.grafana_alert,
          notification_settings: { policy: CUSTOM_POLICY_NAME },
        },
      };
      const group: RulerRuleGroupDTO<RulerGrafanaRuleDTO> = {
        ...grafanaRulerGroup,
        rules: [ruleWithPolicy],
      };
      server.use(
        http.get(`/api/ruler/grafana/api/v1/rules/${grafanaRulerNamespace.uid}/${grafanaRulerGroup.name}`, () =>
          HttpResponse.json(group)
        )
      );
    });

    it('pre-selects and round-trips notification_settings.policy without adding a legacy label', async () => {
      const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));

      const { user } = renderRuleEditor(grafanaRulerRule.grafana_alert.uid);
      const notificationStep = await ui.formSteps.notification.find();

      await waitFor(() => {
        expect(policyTreeUi.policySelector.get(notificationStep)).toBeEnabled();
      });
      expect(within(notificationStep).getByDisplayValue(CUSTOM_POLICY_NAME)).toBeInTheDocument();
      expect(policyTreeUi.changeButton.query(notificationStep)).not.toBeInTheDocument();
      expect(policyTreeUi.defaultBadge.query(notificationStep)).not.toBeInTheDocument();

      await user.click(ui.buttons.save.get());
      const requests = await capture;
      const bodies = await Promise.all(
        requests.map((r) => r.json() as Promise<RulerRuleGroupDTO<RulerGrafanaRuleDTO>>)
      );
      const savedRule = bodies[0].rules.find((r) => r.grafana_alert.title === grafanaRulerRule.grafana_alert.title);

      expect(savedRule?.grafana_alert.notification_settings?.policy).toBe(CUSTOM_POLICY_NAME);
      expect(savedRule?.labels?.[NAMED_ROOT_LABEL_NAME]).toBeUndefined();
    });
  });

  // A rule can point at a tree the dropdown doesn't list: it was deleted, or the list only contains
  // the trees this user is allowed to read. Those are indistinguishable from the client, so the
  // assignment has to stay both visible and intact either way.
  describe('rule pointing at a policy tree missing from the list', () => {
    const MISSING_POLICY_NAME = 'tree-not-in-the-list';

    beforeEach(() => {
      setFolderResponse(
        mockFolder({
          uid: grafanaRulerNamespace.uid,
          title: grafanaRulerNamespace.name,
          accessControl: {
            [AccessControlAction.AlertingRuleRead]: true,
            [AccessControlAction.AlertingRuleUpdate]: true,
            [AccessControlAction.FoldersRead]: true,
          },
        })
      );

      const ruleWithMissingPolicy: RulerGrafanaRuleDTO = {
        ...grafanaRulerRule,
        labels: {},
        grafana_alert: {
          ...grafanaRulerRule.grafana_alert,
          notification_settings: { policy: MISSING_POLICY_NAME },
        },
      };
      const group: RulerRuleGroupDTO<RulerGrafanaRuleDTO> = {
        ...grafanaRulerGroup,
        rules: [ruleWithMissingPolicy],
      };
      server.use(
        http.get(`/api/ruler/grafana/api/v1/rules/${grafanaRulerNamespace.uid}/${grafanaRulerGroup.name}`, () =>
          HttpResponse.json(group)
        )
      );
    });

    it('does not warn when the policy is in the list', async () => {
      // Same rule shape, but pointing at a tree the list actually contains.
      const ruleWithKnownPolicy: RulerGrafanaRuleDTO = {
        ...grafanaRulerRule,
        labels: {},
        grafana_alert: {
          ...grafanaRulerRule.grafana_alert,
          notification_settings: { policy: 'Managed Policy - Empty Provisioned' },
        },
      };
      server.use(
        http.get(`/api/ruler/grafana/api/v1/rules/${grafanaRulerNamespace.uid}/${grafanaRulerGroup.name}`, () =>
          HttpResponse.json({ ...grafanaRulerGroup, rules: [ruleWithKnownPolicy] })
        )
      );

      renderRuleEditor(grafanaRulerRule.grafana_alert.uid);
      const notificationStep = await ui.formSteps.notification.find();

      await waitFor(() => {
        expect(within(notificationStep).getByDisplayValue('Managed Policy - Empty Provisioned')).toBeInTheDocument();
      });
      expect(policyTreeUi.missingPolicyWarning.query(notificationStep)).not.toBeInTheDocument();
    });

    it('shows the missing policy and a warning, and preserves the policy on save', async () => {
      const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));

      const { user } = renderRuleEditor(grafanaRulerRule.grafana_alert.uid);
      const notificationStep = await ui.formSteps.notification.find();

      await waitFor(() => {
        expect(policyTreeUi.policySelector.get(notificationStep)).toBeEnabled();
      });
      expect(within(notificationStep).getByDisplayValue(MISSING_POLICY_NAME)).toBeInTheDocument();
      expect(policyTreeUi.defaultBadge.query(notificationStep)).not.toBeInTheDocument();
      expect(await policyTreeUi.missingPolicyWarning.find(notificationStep)).toBeInTheDocument();

      await user.click(ui.buttons.save.get());

      const requests = await capture;
      const bodies = await Promise.all(
        requests.map((r) => r.json() as Promise<RulerRuleGroupDTO<RulerGrafanaRuleDTO>>)
      );
      const savedRule = bodies[0].rules.find((r) => r.grafana_alert.title === grafanaRulerRule.grafana_alert.title);

      expect(savedRule?.grafana_alert.notification_settings?.policy).toBe(MISSING_POLICY_NAME);
      expect(savedRule?.labels?.[NAMED_ROOT_LABEL_NAME]).toBeUndefined();
    });
  });
});
