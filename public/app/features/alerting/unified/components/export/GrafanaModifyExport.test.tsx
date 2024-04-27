import { render, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Route } from 'react-router-dom';
import { Props } from 'react-virtualized-auto-sizer';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { locationService } from '@grafana/runtime';

import { TestProvider } from '../../../../../../test/helpers/TestProvider';
import { AlertmanagerChoice } from '../../../../../plugins/datasource/alertmanager/types';
import { DashboardSearchItemType } from '../../../../search/types';
import { mockAlertRuleApi, mockApi, mockExportApi, mockSearchApi, setupMswServer } from '../../mockApi';
import { getGrafanaRule, mockDashboardSearchItem, mockDataSource } from '../../mocks';
import { mockAlertmanagerChoiceResponse } from '../../mocks/alertmanagerApi';
import { setupDataSources } from '../../testSetup/datasources';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import GrafanaModifyExport from './GrafanaModifyExport';

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

jest.mock('react-virtualized-auto-sizer', () => {
  return ({ children }: Props) =>
    children({
      height: 600,
      scaledHeight: 600,
      scaledWidth: 1,
      width: 1,
    });
});
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: ({ value }: { value: string }) => <textarea data-testid="code-editor" value={value} readOnly />,
}));

const ui = {
  loading: byText('Loading the rule'),
  form: {
    nameInput: byRole('textbox', { name: 'name' }),
    folder: byTestId('folder-picker'),
    group: byTestId('group-picker'),
    annotationKey: (idx: number) => byTestId(`annotation-key-${idx}`),
    annotationValue: (idx: number) => byTestId(`annotation-value-${idx}`),
    labelKey: (idx: number) => byTestId(`label-key-${idx}`),
    labelValue: (idx: number) => byTestId(`label-value-${idx}`),
  },
  exportButton: byRole('button', { name: 'Export' }),
  exportDrawer: {
    dialog: byRole('dialog', { name: /Export Group/ }),
    jsonTab: byRole('tab', { name: /JSON/ }),
    yamlTab: byRole('tab', { name: /YAML/ }),
    editor: byTestId('code-editor'),
    loadingSpinner: byTestId('Spinner'),
  },
};

const dataSources = {
  default: mockDataSource({ type: 'prometheus', name: 'Prom', isDefault: true }, { alerting: true }),
};

function renderModifyExport(ruleId: string) {
  locationService.push(`/alerting/${ruleId}/modify-export`);
  render(<Route path="/alerting/:id/modify-export" component={GrafanaModifyExport} />, { wrapper: TestProvider });
}

const server = setupMswServer();

mockAlertmanagerChoiceResponse(server, {
  alertmanagersChoice: AlertmanagerChoice.Internal,
  numExternalAlertmanagers: 0,
});

describe('GrafanaModifyExport', () => {
  setupDataSources(dataSources.default);

  const grafanaRule = getGrafanaRule(undefined, {
    uid: 'test-rule-uid',
    title: 'cpu-usage',
    namespace_uid: 'folderUID1',
    data: [
      {
        refId: 'A',
        datasourceUid: dataSources.default.uid,
        queryType: 'alerting',
        relativeTimeRange: { from: 1000, to: 2000 },
        model: {
          refId: 'A',
          expression: 'vector(1)',
          queryType: 'alerting',
          datasource: { uid: dataSources.default.uid, type: 'prometheus' },
        },
      },
    ],
  });

  it('Should render edit form for the specified rule', async () => {
    mockApi(server).eval({ results: { A: { frames: [] } } });
    mockSearchApi(server).search([
      mockDashboardSearchItem({
        title: grafanaRule.namespace.name,
        uid: 'folderUID1',
        url: '',
        tags: [],
        type: DashboardSearchItemType.DashFolder,
      }),
    ]);
    mockAlertRuleApi(server).rulerRules(GRAFANA_RULES_SOURCE_NAME, {
      [grafanaRule.namespace.name]: [{ name: grafanaRule.group.name, interval: '1m', rules: [grafanaRule.rulerRule!] }],
    });
    mockAlertRuleApi(server).rulerRuleGroup(GRAFANA_RULES_SOURCE_NAME, 'folderUID1', grafanaRule.group.name, {
      name: grafanaRule.group.name,
      interval: '1m',
      rules: [grafanaRule.rulerRule!],
    });
    mockExportApi(server).modifiedExport('folderUID1', {
      yaml: 'Yaml Export Content',
      json: 'Json Export Content',
    });

    const user = userEvent.setup();

    renderModifyExport('test-rule-uid');

    await waitForElementToBeRemoved(() => ui.loading.get());
    expect(await ui.form.nameInput.find()).toHaveValue('cpu-usage');

    await user.click(ui.exportButton.get());

    const drawer = await ui.exportDrawer.dialog.find();
    expect(drawer).toBeInTheDocument();

    expect(ui.exportDrawer.yamlTab.get(drawer)).toHaveAttribute('aria-selected', 'true');

    await waitFor(() => {
      expect(ui.exportDrawer.editor.get(drawer)).toHaveTextContent('Yaml Export Content');
    });
  });
});
