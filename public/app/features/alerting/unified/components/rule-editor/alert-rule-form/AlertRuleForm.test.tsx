import { HttpResponse } from 'msw';
import * as React from 'react';
import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { screen, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { locationService, setPluginLinksHook } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { PROMETHEUS_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { AccessControlAction } from 'app/types/accessControl';

import { grantUserPermissions, mockDataSource } from '../../../mocks';
import { grafanaRulerGroup, mockPreviewApiResponse } from '../../../mocks/grafanaRulerApi';
import { setUpdateGrafanaRulerRuleNamespaceResolver } from '../../../mocks/server/configure';
import { setupDataSources } from '../../../testSetup/datasources';

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

jest.setTimeout(60 * 1000);

const server = setupMswServer();

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

setPluginLinksHook(() => ({ links: [], isLoading: false }));

const fillNewGrafanaRule = async (user: ReturnType<typeof renderRuleEditor>['user']) => {
  await user.type(await ui.inputs.name.find(), 'my new rule');
  await user.click(await screen.findByRole('button', { name: /select folder/i }));
  await user.click(await screen.findByLabelText('Folder A'));
  const groupInput = await ui.inputs.group.find();
  await user.click(await byRole('combobox').find(groupInput));
  await clickSelectOption(groupInput, grafanaRulerGroup.name);
  await user.type(ui.inputs.annotationValue(1).get(), 'some description');
};

describe('AlertRuleForm submit failure handling', () => {
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

    mockPreviewApiResponse(server, []);
  });

  it('surfaces a form-level error notification when creating a rule fails and does not redirect', async () => {
    setUpdateGrafanaRulerRuleNamespaceResolver(async () =>
      HttpResponse.json({ message: 'boom from the api' }, { status: 500 })
    );
    const replaceSpy = jest.spyOn(locationService, 'replace');

    const { user } = renderRuleEditor();

    await fillNewGrafanaRule(user);
    await user.click(ui.buttons.save.get());

    expect(await screen.findByText(/Failed to save alert rule/i)).toBeInTheDocument();
    expect(screen.queryByText(/Rule added successfully/i)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(ui.buttons.save.get()).toBeEnabled();
    });
    expect(replaceSpy).not.toHaveBeenCalled();
  });
});
