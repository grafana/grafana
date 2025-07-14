import * as React from 'react';
import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption, selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { screen, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { contextSrv } from 'app/core/services/context_srv';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { PROMETHEUS_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { DashboardSearchItemType } from 'app/features/search/types';
import { AccessControlAction } from 'app/types/accessControl';

import { grantUserPermissions, mockDataSource, mockFolder } from '../mocks';
import { grafanaRulerGroup, grafanaRulerGroup2, grafanaRulerRule } from '../mocks/grafanaRulerApi';
import { setFolderResponse } from '../mocks/server/configure';
import { captureRequests, serializeRequests } from '../mocks/server/events';
import { setupDataSources } from '../testSetup/datasources';
import { Annotation } from '../utils/constants';
import { grafanaRuleDtoToFormValues } from '../utils/rule-form';

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

jest.setTimeout(60 * 1000);

setupMswServer();

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
};

setupDataSources(dataSources.default);

describe('RuleEditor grafana managed rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    ]);
  });

  it('can create new grafana managed alert', async () => {
    const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));

    const { user } = renderRuleEditor();

    await user.type(await ui.inputs.name.find(), 'my great new rule');
    await user.click(await screen.findByRole('button', { name: /select folder/i }));
    await user.click(await screen.findByLabelText(/folder a/i));
    const groupInput = await ui.inputs.group.find();
    await user.click(await byRole('combobox').find(groupInput));
    await clickSelectOption(groupInput, grafanaRulerGroup.name);
    await user.type(ui.inputs.annotationValue(1).get(), 'some description');

    await user.click(ui.buttons.save.get());

    expect(await screen.findByRole('status')).toHaveTextContent('Rule added successfully');
    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  // FIXME: This should work (i.e. the necessary setup is done, and the preview should trigger an error)
  // but for some reason the alert error doesn't render
  it.skip('shows an error when trying to use time series as alert condition', async () => {
    setupDataSources(dataSources.default);
    const { user } = renderRuleEditor();

    // Select Prometheus data source
    const dataSourceInput = await ui.inputs.dataSource.find();
    await user.click(dataSourceInput);
    await user.click(await screen.findByRole('button', { name: new RegExp(dataSources.default.name) }));

    // Change to `code` editor, and type in something that would give us a time series response
    await user.click(screen.getByLabelText(/code/i));
    await user.click(screen.getByTestId('data-testid Query field'));
    // We have to escape the curly braces because they have special meaning to the RTL keyboard API
    await user.keyboard('sum(counters_logins{{}})');

    // Expand the options and select "range" instead
    await user.click(screen.getByRole('button', { name: /type: instant/i }));
    await user.click(screen.getByLabelText(/range/i));

    await user.click(screen.getByRole('button', { name: /remove expression "b"/i }));
    await selectOptionInTest(await screen.findByLabelText(/input/i), 'A');

    await user.click(ui.buttons.preview.get());
    expect(await screen.findByText(/you cannot use time series data as an alert condition/i)).toBeInTheDocument();
  });
  it('can restore grafana managed alert when isManualRestore is passed as query param', async () => {
    const folder = {
      title: 'Folder A',
      uid: grafanaRulerRule.grafana_alert.namespace_uid,
      id: 1,
      type: DashboardSearchItemType.DashDB,
      accessControl: {
        [AccessControlAction.AlertingRuleUpdate]: true,
      },
    };
    setFolderResponse(mockFolder(folder));
    const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));
    const grafanaRuleJson = JSON.stringify(grafanaRuleDtoToFormValues(grafanaRulerRule, folder.title));

    const { user } = renderRuleEditor(undefined, undefined, grafanaRuleJson); // isManualRestore=true

    // check that it's filled in
    const nameInput = await ui.inputs.name.find();
    expect(nameInput).toHaveValue(grafanaRulerRule.grafana_alert.title);
    //check that folder is in the list
    await waitFor(() => expect(ui.inputs.folder.get()).toHaveTextContent(new RegExp(folder.title)));
    expect(ui.inputs.annotationValue(0).get()).toHaveValue(grafanaRulerRule.annotations?.[Annotation.summary]);

    expect(ui.manualRestoreBanner.get()).toBeInTheDocument(); // check that manual restore banner is shown

    await user.click(ui.buttons.save.get());

    expect(await screen.findByRole('status')).toHaveTextContent('Rule added successfully');
    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should keep existing group interval when creating new rule in existing group', async () => {
    const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));

    const { user } = renderRuleEditor();

    await user.type(await ui.inputs.name.find(), 'my great new rule');
    await user.click(await screen.findByRole('button', { name: /select folder/i }));
    await user.click(await screen.findByLabelText(/folder a/i));

    // Select the existing group with 5m interval
    const groupInput = await ui.inputs.group.find();
    await user.click(await byRole('combobox').find(groupInput));
    await clickSelectOption(groupInput, grafanaRulerGroup2.name);
    await user.type(ui.inputs.annotationValue(1).get(), 'some description');

    // Set pending period to none (0s) to avoid validation errors
    const pendingPeriodInput = await ui.inputs.pendingPeriod.find();
    await user.clear(pendingPeriodInput);
    await user.type(pendingPeriodInput, '0s');

    await user.click(ui.buttons.save.get());

    expect(await screen.findByRole('status')).toHaveTextContent('Rule added successfully');
    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);

    // Verify that the existing group's 5m interval is preserved
    const saveRequest = serializedRequests.find((req) => req.method === 'POST');
    expect(saveRequest).toBeDefined();
    expect(saveRequest?.body).toMatchObject({
      name: grafanaRulerGroup2.name,
      interval: '5m', // The existing group's interval should be preserved
      rules: expect.arrayContaining([
        expect.objectContaining({
          annotations: expect.objectContaining({
            description: 'some description',
          }),
          for: '0s',
        }),
      ]),
    });
  });
});
