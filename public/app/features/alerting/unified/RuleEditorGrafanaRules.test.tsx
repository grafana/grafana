import * as React from 'react';
import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { screen } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { contextSrv } from 'app/core/services/context_srv';
import { mockFeatureDiscoveryApi, setupMswServer } from 'app/features/alerting/unified/mockApi';
import { AccessControlAction } from 'app/types';

import { grantUserPermissions, mockDataSource } from './mocks';
import { grafanaRulerGroup } from './mocks/grafanaRulerApi';
import { setupDataSources } from './testSetup/datasources';
import { buildInfoResponse } from './testSetup/featureDiscovery';

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

jest.setTimeout(60 * 1000);

const server = setupMswServer();

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
    const dataSources = {
      default: mockDataSource(
        {
          type: 'prometheus',
          name: 'Prom',
          isDefault: true,
        },
        { alerting: false }
      ),
    };

    setupDataSources(dataSources.default);
    mockFeatureDiscoveryApi(server).discoverDsFeatures(dataSources.default, buildInfoResponse.mimir);

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
  });
});
