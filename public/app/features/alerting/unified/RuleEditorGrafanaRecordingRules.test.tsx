import { UserEvent } from '@testing-library/user-event';
import * as React from 'react';
import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { screen } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { FeatureToggles } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { PROMETHEUS_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { AccessControlAction } from 'app/types';

import { grantUserPermissions, mockDataSource } from './mocks';
import { grafanaRulerGroup } from './mocks/grafanaRulerApi';
import { captureRequests, serializeRequests } from './mocks/server/events';
import { FOLDER_TITLE_HAPPY_PATH } from './mocks/server/handlers/search';
import { testWithFeatureToggles } from './test/test-utils';
import { setupDataSources } from './testSetup/datasources';

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

jest.setTimeout(60 * 1000);

setupMswServer();

const selectFolderAndGroup = async (user: UserEvent) => {
  await user.click(await screen.findByRole('button', { name: /select folder/i }));
  await user.click(await screen.findByLabelText(FOLDER_TITLE_HAPPY_PATH));
  const groupInput = await ui.inputs.group.find();
  await user.click(await byRole('combobox').find(groupInput));
  await clickSelectOption(groupInput, grafanaRulerGroup.name);
};

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
describe('RuleEditor grafana recording rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDataSources(dataSources.default);
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

  const testCreateGrafanaRR = (featureToggles: Array<keyof FeatureToggles>, testName: string) => {
    testWithFeatureToggles(featureToggles);

    it(testName, async () => {
      const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));

      const { user } = renderRuleEditor(undefined, 'grafana-recording');

      await user.type(await ui.inputs.name.find(), 'my great new rule');
      await user.type(await ui.inputs.metric.find(), 'metricName');
      await selectFolderAndGroup(user);

      await user.click(ui.buttons.saveAndExit.get());

      const requests = await capture;
      const serializedRequests = await serializeRequests(requests);
      expect(serializedRequests).toMatchSnapshot();
    });
  };

  const testCreateGrafanaRRWithInvalidMetricName = (featureToggles: Array<keyof FeatureToggles>, testName: string) => {
    testWithFeatureToggles(featureToggles);

    it(testName, async () => {
      const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));
      const { user } = renderRuleEditor(undefined, 'grafana-recording');

      await user.type(await ui.inputs.name.find(), 'my great new rule');
      await selectFolderAndGroup(user);

      await user.click(ui.buttons.saveAndExit.get());
      const requests = await capture;
      expect(requests).toHaveLength(0);
    });
  };

  testCreateGrafanaRR([], 'can create new grafana recording rule with simplified steps feature toggles disabled');
  testCreateGrafanaRR(
    ['alertingQueryAndExpressionsStepMode', 'alertingNotificationsStepMode'],
    'can create new grafana recording rule with simplified steps enabled'
  );

  testCreateGrafanaRRWithInvalidMetricName(
    [],
    'cannot create new grafana recording rule with invalid metric name with simplified steps feature toggles disabled'
  );
  testCreateGrafanaRRWithInvalidMetricName(
    ['alertingQueryAndExpressionsStepMode', 'alertingNotificationsStepMode'],
    'cannot create new grafana recording rule with invalid metric name with simplified steps enabled'
  );
});
