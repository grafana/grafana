import * as React from 'react';
import { Route } from 'react-router-dom';
import { Props } from 'react-virtualized-auto-sizer';
import { render, waitFor, waitForElementToBeRemoved, userEvent } from 'test/test-utils';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { DashboardSearchItemType } from '../../../../search/types';
import { mockExportApi, mockSearchApi, setupMswServer } from '../../mockApi';
import { mockDashboardSearchItem, mockDataSource } from '../../mocks';
import { grafanaRulerRule } from '../../mocks/grafanaRulerApi';
import { setupDataSources } from '../../testSetup/datasources';

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
  loading: byText('Loading the rule...'),
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
  render(<Route path="/alerting/:id/modify-export" component={GrafanaModifyExport} />, {
    historyOptions: { initialEntries: [`/alerting/${ruleId}/modify-export`] },
  });
}

const server = setupMswServer();

describe('GrafanaModifyExport', () => {
  setupDataSources(dataSources.default);

  it('Should render edit form for the specified rule', async () => {
    mockSearchApi(server).search([
      mockDashboardSearchItem({
        title: grafanaRulerRule.grafana_alert.title,
        uid: grafanaRulerRule.grafana_alert.namespace_uid,
        url: '',
        tags: [],
        type: DashboardSearchItemType.DashFolder,
      }),
    ]);
    mockExportApi(server).modifiedExport(grafanaRulerRule.grafana_alert.namespace_uid, {
      yaml: 'Yaml Export Content',
      json: 'Json Export Content',
    });

    const user = userEvent.setup();

    renderModifyExport(grafanaRulerRule.grafana_alert.uid);

    await waitForElementToBeRemoved(() => ui.loading.get());
    expect(await ui.form.nameInput.find()).toHaveValue('Grafana-rule');

    await user.click(ui.exportButton.get());

    const drawer = await ui.exportDrawer.dialog.find();
    expect(drawer).toBeInTheDocument();

    expect(ui.exportDrawer.yamlTab.get(drawer)).toHaveAttribute('aria-selected', 'true');

    await waitFor(() => {
      expect(ui.exportDrawer.editor.get(drawer)).toHaveTextContent('Yaml Export Content');
    });
  });
});
