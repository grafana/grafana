import { ReactNode } from 'react';
import { Routes, Route } from 'react-router-dom-v5-compat';
import { ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { render, screen, waitForElementToBeRemoved, userEvent } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import RuleEditor from 'app/features/alerting/unified/RuleEditor';
import { mockFeatureDiscoveryApi, setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions, mockDataSource } from 'app/features/alerting/unified/mocks';
import { setAlertmanagerChoices } from 'app/features/alerting/unified/mocks/server/configure';
import { captureRequests, serializeRequests } from 'app/features/alerting/unified/mocks/server/events';
import { FOLDER_TITLE_HAPPY_PATH } from 'app/features/alerting/unified/mocks/server/handlers/search';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { testWithFeatureToggles } from 'app/features/alerting/unified/test/test-utils';
import { buildInfoResponse } from 'app/features/alerting/unified/testSetup/featureDiscovery';
import { DataSourceType, GRAFANA_DATASOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';

import { grafanaRulerGroup } from '../../../../mocks/grafanaRulerApi';
import { setupDataSources } from '../../../../testSetup/datasources';

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: ReactNode }) => <div>{actions}</div>,
}));

jest.setTimeout(60 * 1000);

const server = setupMswServer();

const dataSources = {
  default: mockDataSource(
    {
      type: 'prometheus',
      name: 'Prom',
      isDefault: true,
    },
    { alerting: false }
  ),
  am: mockDataSource({
    name: 'Alertmanager',
    type: DataSourceType.Alertmanager,
  }),
};

setupDataSources(dataSources.default, dataSources.am);

const selectFolderAndGroup = async () => {
  const user = userEvent.setup();
  const folderInput = await ui.inputs.folder.find();
  await clickSelectOption(folderInput, FOLDER_TITLE_HAPPY_PATH);
  const groupInput = await ui.inputs.group.find();
  await user.click(await byRole('combobox').find(groupInput));
  await clickSelectOption(groupInput, grafanaRulerGroup.name);
};

describe('Can create a new grafana managed alert using simplified routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contextSrv.isEditor = true;
    contextSrv.hasEditPermissionInFolders = true;
    config.featureToggles.alertingSimplifiedRouting = true;
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

    mockFeatureDiscoveryApi(server).discoverDsFeatures(dataSources.default, buildInfoResponse.mimir);
  });

  it('cannot create new grafana managed alert when using simplified routing and not selecting a contact point', async () => {
    const user = userEvent.setup();
    const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));

    renderSimplifiedRuleEditor();
    await waitForElementToBeRemoved(screen.queryAllByTestId('Spinner'));

    await user.type(await ui.inputs.name.find(), 'my great new rule');

    await selectFolderAndGroup();

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
    renderSimplifiedRuleEditor();
    await waitForElementToBeRemoved(screen.queryAllByTestId('Spinner'));

    expect(ui.inputs.simplifiedRouting.contactPointRouting.query()).not.toBeInTheDocument();
  });

  it('can create new grafana managed alert when using simplified routing and selecting a contact point', async () => {
    const user = userEvent.setup();
    const contactPointName = 'lotsa-emails';
    const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));

    renderSimplifiedRuleEditor();
    await waitForElementToBeRemoved(screen.queryAllByTestId('Spinner'));

    await user.type(await ui.inputs.name.find(), 'my great new rule');

    await selectFolderAndGroup();

    //select contact point routing
    await user.click(ui.inputs.simplifiedRouting.contactPointRouting.get());
    const contactPointInput = await ui.inputs.simplifiedRouting.contactPoint.find();
    await user.click(byRole('combobox').get(contactPointInput));
    await clickSelectOption(contactPointInput, contactPointName);

    // save and check what was sent to backend
    await user.click(ui.buttons.saveAndExit.get());
    const requests = await capture;

    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  describe('alertingApiServer enabled', () => {
    testWithFeatureToggles(['alertingApiServer']);

    it('allows selecting a contact point when using alerting API server', async () => {
      const user = userEvent.setup();
      renderSimplifiedRuleEditor();
      await waitForElementToBeRemoved(screen.queryAllByTestId('Spinner'));

      await user.click(await ui.inputs.simplifiedRouting.contactPointRouting.find());

      const contactPointInput = await ui.inputs.simplifiedRouting.contactPoint.find();
      await user.click(byRole('combobox').get(contactPointInput));
      await clickSelectOption(contactPointInput, 'lotsa-emails');

      expect(await screen.findByText('Email')).toBeInTheDocument();
    });
  });
});

function renderSimplifiedRuleEditor() {
  return render(
    <AlertmanagerProvider alertmanagerSourceName={GRAFANA_DATASOURCE_NAME} accessType="notification">
      <Routes>
        <Route path={'/alerting/new/:type'} element={<RuleEditor />} />
        <Route path={'/alerting/:id/edit'} element={<RuleEditor />} />
      </Routes>
    </AlertmanagerProvider>,
    { historyOptions: { initialEntries: ['/alerting/new/alerting'] } }
  );
}
