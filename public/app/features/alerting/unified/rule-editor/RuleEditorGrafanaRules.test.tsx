import * as React from 'react';
import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption, selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { screen } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { contextSrv } from 'app/core/services/context_srv';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { PROMETHEUS_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { AccessControlAction } from 'app/types';

import { grantUserPermissions, mockDataSource } from '../mocks';
import { grafanaRulerGroup } from '../mocks/grafanaRulerApi';
import { captureRequests, serializeRequests } from '../mocks/server/events';
import { setupDataSources } from '../testSetup/datasources';

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

    await user.click(ui.buttons.saveAndExit.get());

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
});
