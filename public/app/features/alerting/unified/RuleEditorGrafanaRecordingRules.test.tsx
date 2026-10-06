import { type UserEvent } from '@testing-library/user-event';
import { produce } from 'immer';
import { HttpResponse } from 'msw';
import * as React from 'react';
import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { screen, testWithFeatureToggles, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { type FeatureToggles } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';
import { mockBoundingClientRect } from '@grafana/test-utils';
import { contextSrv } from 'app/core/services/context_srv';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { PROMETHEUS_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { AccessControlAction } from 'app/types/accessControl';

import { grantUserPermissions, mockDataSource } from './mocks';
import { grafanaRulerGroup, grafanaRulerRecordingGroup, grafanaRulerRecordingRule } from './mocks/grafanaRulerApi';
import {
  setFolderAccessControl,
  setGrafanaRulerRuleGroupResolver,
  setGrafanaRulerRuleResolver,
} from './mocks/server/configure';
import { captureRequests, serializeRequests } from './mocks/server/events';
import { FOLDER_TITLE_HAPPY_PATH } from './mocks/server/handlers/folders';
import { setupDataSources } from './testSetup/datasources';
import { setupPluginsExtensionsHook } from './testSetup/plugins';

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

jest.mock('@grafana/runtime/unstable', () => {
  const actual = jest.requireActual('@grafana/runtime/unstable');
  return { ...actual, getDataSourceInstanceList: jest.fn(actual.getDataSourceInstanceList) };
});

const runtime = jest.requireActual('@grafana/runtime/unstable');
const listMock = jest.mocked(getDataSourceInstanceList);

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

// Setup plugin extensions hook to prevent setPluginLinksHook errors
setupPluginsExtensionsHook();

beforeAll(() => {
  mockBoundingClientRect();
});

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
    testWithFeatureToggles({ enable: featureToggles });

    it(testName, async () => {
      const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));

      const { user } = renderRuleEditor(undefined, 'grafana-recording');

      await user.type(await ui.inputs.name.find(), 'my great new rule');
      await user.type(await ui.inputs.metric.find(), 'metricName');

      const targetDsField = await ui.inputs.targetDatasource.find();
      const dsPickerInput = await ui.inputs.dataSource.find(targetDsField);
      await user.click(dsPickerInput);
      await user.click(await screen.findByText('Prom'));

      await selectFolderAndGroup(user);

      await user.click(ui.buttons.save.get());

      const requests = await capture;
      const serializedRequests = await serializeRequests(requests);
      expect(serializedRequests).toMatchSnapshot();
    });
  };

  const testCreateGrafanaRRWithInvalidMetricName = (featureToggles: Array<keyof FeatureToggles>, testName: string) => {
    testWithFeatureToggles({ enable: featureToggles });

    it(testName, async () => {
      const capture = captureRequests((r) => r.method === 'POST' && r.url.includes('/api/ruler/'));
      const { user } = renderRuleEditor(undefined, 'grafana-recording');

      await user.type(await ui.inputs.name.find(), 'my great new rule');

      const targetDsField = await ui.inputs.targetDatasource.find();
      const dsPickerInput = await ui.inputs.dataSource.find(targetDsField);
      await user.click(dsPickerInput);
      await user.click(await screen.findByText('Prom'));

      await selectFolderAndGroup(user);

      await user.click(ui.buttons.save.get());
      const requests = await capture;
      expect(requests).toHaveLength(0);
    });
  };

  testCreateGrafanaRR([], 'can create new grafana recording rule with simplified steps feature toggles disabled');
  testCreateGrafanaRR(
    ['alertingNotificationsStepMode'],
    'can create new grafana recording rule with simplified steps enabled'
  );

  testCreateGrafanaRRWithInvalidMetricName(
    [],
    'cannot create new grafana recording rule with invalid metric name with simplified steps feature toggles disabled'
  );
  testCreateGrafanaRRWithInvalidMetricName(
    ['alertingNotificationsStepMode'],
    'cannot create new grafana recording rule with invalid metric name with simplified steps enabled'
  );
  describe('target data source', () => {
    afterEach(() => {
      config.unifiedAlerting.defaultRecordingRulesTargetDatasourceUID = undefined;
      listMock.mockImplementation(runtime.getDataSourceInstanceList);
    });

    async function findTargetPicker() {
      return ui.inputs.dataSource.find(await ui.inputs.targetDatasource.find());
    }

    function editRecordingRuleWithTarget(targetDatasourceUid: string | undefined) {
      const rule = produce(grafanaRulerRecordingRule, (draft) => {
        draft.grafana_alert.record = { metric: 'rec_metric', from: 'A', target_datasource_uid: targetDatasourceUid };
      });
      setFolderAccessControl({
        [AccessControlAction.AlertingRuleRead]: true,
        [AccessControlAction.AlertingRuleUpdate]: true,
        [AccessControlAction.FoldersRead]: true,
      });
      setGrafanaRulerRuleResolver(() => HttpResponse.json(rule));
      setGrafanaRulerRuleGroupResolver(() => HttpResponse.json({ ...grafanaRulerRecordingGroup, rules: [rule] }));
      renderRuleEditor(rule.grafana_alert.uid, 'grafana-recording');
    }

    it('disables the target picker until the valid targets are known', async () => {
      let releaseDiscovery = () => {};
      const released = new Promise<void>((resolve) => {
        releaseDiscovery = resolve;
      });
      listMock.mockImplementation(async (filters) => {
        await released;
        return runtime.getDataSourceInstanceList(filters);
      });
      renderRuleEditor(undefined, 'grafana-recording');

      const targetPicker = await findTargetPicker();
      expect(targetPicker).toBeDisabled();

      releaseDiscovery();
      await waitFor(() => expect(targetPicker).toBeEnabled());
    });

    it('preselects the configured default target when it accepts recording rules', async () => {
      config.unifiedAlerting.defaultRecordingRulesTargetDatasourceUID = PROMETHEUS_DATASOURCE_UID;
      renderRuleEditor(undefined, 'grafana-recording');

      const targetPicker = await findTargetPicker();

      await waitFor(() => expect(targetPicker).toHaveAttribute('placeholder', 'Prom'));
    });

    it('does not preselect a configured default target that opts out of recording rules', async () => {
      setupDataSources(
        mockDataSource(
          {
            type: 'prometheus',
            name: 'Prom',
            uid: PROMETHEUS_DATASOURCE_UID,
            isDefault: true,
            jsonData: { allowAsRecordingRulesTarget: false },
          },
          { alerting: true, module: 'core:plugin/prometheus' }
        )
      );
      config.unifiedAlerting.defaultRecordingRulesTargetDatasourceUID = PROMETHEUS_DATASOURCE_UID;
      renderRuleEditor(undefined, 'grafana-recording');

      const targetPicker = await findTargetPicker();
      await waitFor(() => expect(targetPicker).toBeEnabled());

      expect(targetPicker).toHaveAttribute('placeholder', 'Select data source');
    });

    it('keeps the saved target of an existing rule instead of the configured default', async () => {
      setupDataSources(
        dataSources.default,
        mockDataSource(
          { type: 'prometheus', name: 'Prom 2', uid: 'prom-2' },
          { alerting: true, module: 'core:plugin/prometheus' }
        )
      );
      config.unifiedAlerting.defaultRecordingRulesTargetDatasourceUID = PROMETHEUS_DATASOURCE_UID;
      editRecordingRuleWithTarget('prom-2');

      const targetPicker = await findTargetPicker();
      await waitFor(() => expect(targetPicker).toBeEnabled());

      expect(targetPicker).toHaveAttribute('placeholder', 'Prom 2');
    });

    it('preselects the configured default for an existing rule saved without a target', async () => {
      config.unifiedAlerting.defaultRecordingRulesTargetDatasourceUID = PROMETHEUS_DATASOURCE_UID;
      editRecordingRuleWithTarget(undefined);

      const targetPicker = await findTargetPicker();

      await waitFor(() => expect(targetPicker).toHaveAttribute('placeholder', 'Prom'));
    });
  });
});
