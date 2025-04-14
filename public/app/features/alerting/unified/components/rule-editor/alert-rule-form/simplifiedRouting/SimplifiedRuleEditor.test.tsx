import { UserEvent } from '@testing-library/user-event';
import { ReactNode } from 'react';
import { GrafanaRuleFormStep, renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { screen, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { contextSrv } from 'app/core/services/context_srv';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions, mockDataSource } from 'app/features/alerting/unified/mocks';
import { setAlertmanagerChoices } from 'app/features/alerting/unified/mocks/server/configure';
import { PROMETHEUS_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { captureRequests, serializeRequests } from 'app/features/alerting/unified/mocks/server/events';
import { FOLDER_TITLE_HAPPY_PATH } from 'app/features/alerting/unified/mocks/server/handlers/search';
import { testWithFeatureToggles } from 'app/features/alerting/unified/test/test-utils';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import { MANUAL_ROUTING_KEY, SIMPLIFIED_QUERY_EDITOR_KEY } from 'app/features/alerting/unified/utils/rule-form';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';

import { grafanaRulerGroup } from '../../../../mocks/grafanaRulerApi';

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: ReactNode }) => <div>{actions}</div>,
}));

jest.setTimeout(60 * 1000);

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

const selectFolderAndGroup = async (user: UserEvent) => {
  await user.click(await screen.findByRole('button', { name: /select folder/i }));
  await user.click(await screen.findByLabelText(FOLDER_TITLE_HAPPY_PATH));
  const groupInput = await ui.inputs.group.find();
  await user.click(await byRole('combobox').find(groupInput));
  await clickSelectOption(groupInput, grafanaRulerGroup.name);
};

const selectContactPoint = async (user: UserEvent, contactPointName: string) => {
  const contactPointInput = await ui.inputs.simplifiedRouting.contactPoint.find();
  await user.click(byRole('combobox').get(contactPointInput));
  await clickSelectOption(contactPointInput, contactPointName);
};

setupMswServer();
describe('Can create a new grafana managed alert using simplified routing', () => {
  testWithFeatureToggles(['alertingSimplifiedRouting']);

  beforeEach(() => {
    window.localStorage.clear();
    setupDataSources(dataSources.default, dataSources.am);
    contextSrv.isEditor = true;
    contextSrv.hasEditPermissionInFolders = true;
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
  });

  it('cannot create new grafana managed alert when using simplified routing and not selecting a contact point', async () => {
    const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));

    const { user } = renderRuleEditor();

    await user.type(await ui.inputs.name.find(), 'my great new rule');

    await selectFolderAndGroup(user);

    //select contact point routing
    await user.click(ui.inputs.simplifiedRouting.contactPointRouting.get());

    // do not select a contact point
    // save and check that call to backend was not made
    await user.click(ui.buttons.saveAndExit.get());
    expect(await screen.findByText('Contact point is required.')).toBeInTheDocument();
    const capturedRequests = await capture;

    expect(capturedRequests).toHaveLength(0);
  });

  it('simplified routing is not available when Grafana AM is not enabled', async () => {
    setAlertmanagerChoices(AlertmanagerChoice.External, 1);
    const { user } = renderRuleEditor();

    // Just to make sure all dropdowns have been loaded
    await selectFolderAndGroup(user);
    await waitFor(() => expect(ui.inputs.simplifiedRouting.contactPointRouting.query()).not.toBeInTheDocument());
  });

  it('can create new grafana managed alert when using simplified routing and selecting a contact point', async () => {
    const contactPointName = 'lotsa-emails';
    const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));

    const { user } = renderRuleEditor();

    await user.type(await ui.inputs.name.find(), 'my great new rule');

    await selectFolderAndGroup(user);

    //select contact point routing
    await user.click(ui.inputs.simplifiedRouting.contactPointRouting.get());

    await selectContactPoint(user, contactPointName);

    // save and check what was sent to backend
    await user.click(ui.buttons.saveAndExit.get());
    const requests = await capture;

    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('allows selecting a contact point', async () => {
    const { user } = renderRuleEditor();

    await user.click(await ui.inputs.simplifiedRouting.contactPointRouting.find());

    await selectContactPoint(user, 'Email');

    expect(await screen.findByText('Email')).toBeInTheDocument();
  });

  describe('switch modes enabled', () => {
    testWithFeatureToggles(['alertingQueryAndExpressionsStepMode', 'alertingNotificationsStepMode']);

    it('can create the new grafana-managed rule with default modes', async () => {
      const contactPointName = 'lotsa-emails';
      const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));

      const { user } = renderRuleEditor();

      await user.type(await ui.inputs.name.find(), 'my great new rule');

      await selectFolderAndGroup(user);

      await selectContactPoint(user, contactPointName);

      // save and check what was sent to backend
      await user.click(ui.buttons.saveAndExit.get());
      const requests = await capture;
      const serializedRequests = await serializeRequests(requests);
      expect(serializedRequests).toMatchSnapshot();
    });

    it('can create the new grafana-managed rule with advanced modes', async () => {
      const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));

      const { user } = renderRuleEditor();

      await user.click(ui.inputs.switchModeBasic(GrafanaRuleFormStep.Query).get()); // switch to query step advanced mode
      await user.click(ui.inputs.switchModeBasic(GrafanaRuleFormStep.Notification).get()); // switch to notifications step advanced mode
      await user.type(await ui.inputs.name.find(), 'my great new rule');

      await selectFolderAndGroup(user);

      // save and check what was sent to backend
      await user.click(ui.buttons.saveAndExit.get());
      const requests = await capture;
      const serializedRequests = await serializeRequests(requests);
      expect(serializedRequests).toMatchSnapshot();
    });

    it('can create the new grafana-managed rule with only notifications step advanced mode', async () => {
      const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));

      const { user } = renderRuleEditor();

      await user.type(await ui.inputs.name.find(), 'my great new rule');

      await selectFolderAndGroup(user);

      await user.click(ui.inputs.switchModeBasic(GrafanaRuleFormStep.Notification).get()); // switch notifications step to advanced mode

      // save and check what was sent to backend
      await user.click(ui.buttons.saveAndExit.get());
      const requests = await capture;
      const serializedRequests = await serializeRequests(requests);
      expect(serializedRequests).toMatchSnapshot();
    });

    it('can create the new grafana-managed rule with only query step advanced mode', async () => {
      const contactPointName = 'lotsa-emails';
      const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));

      const { user } = renderRuleEditor();

      await user.type(await ui.inputs.name.find(), 'my great new rule');

      await selectFolderAndGroup(user);
      await selectContactPoint(user, contactPointName);

      await user.click(ui.inputs.switchModeBasic(GrafanaRuleFormStep.Query).get()); // switch query step to advanced mode

      // save and check what was sent to backend
      await user.click(ui.buttons.saveAndExit.get());
      const requests = await capture;
      const serializedRequests = await serializeRequests(requests);
      expect(serializedRequests).toMatchSnapshot();
    });

    it('switch modes are intiallized depending on the local storage - 1', async () => {
      localStorage.setItem(SIMPLIFIED_QUERY_EDITOR_KEY, 'false');
      localStorage.setItem(MANUAL_ROUTING_KEY, 'true');

      const { user } = renderRuleEditor();
      await selectFolderAndGroup(user);

      expect(ui.inputs.switchModeAdvanced(GrafanaRuleFormStep.Query).get()).toBeInTheDocument();
      expect(ui.inputs.switchModeBasic(GrafanaRuleFormStep.Notification).get()).toBeInTheDocument();
    });

    it('switch modes are intiallized depending on the local storage - 2', async () => {
      localStorage.setItem(SIMPLIFIED_QUERY_EDITOR_KEY, 'true');
      localStorage.setItem(MANUAL_ROUTING_KEY, 'false');

      const { user } = renderRuleEditor();
      await selectFolderAndGroup(user);

      expect(ui.inputs.switchModeBasic(GrafanaRuleFormStep.Query).get()).toBeInTheDocument();
      expect(ui.inputs.switchModeAdvanced(GrafanaRuleFormStep.Notification).get()).toBeInTheDocument();
    });
  });
});
