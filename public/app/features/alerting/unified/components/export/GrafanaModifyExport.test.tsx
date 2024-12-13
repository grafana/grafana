import * as React from 'react';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { Props } from 'react-virtualized-auto-sizer';
import { render, userEvent, waitFor, waitForElementToBeRemoved } from 'test/test-utils';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { mockExportApi, setupMswServer } from '../../mockApi';
import { mockDataSource } from '../../mocks';
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
  },
  exportButton: byRole('button', { name: 'Export' }),
  exportDrawer: {
    dialog: byRole('dialog', { name: /Export Group/ }),
    yamlTab: byRole('tab', { name: /YAML/ }),
    editor: byTestId('code-editor'),
  },
};

const dataSources = {
  default: mockDataSource({ type: 'prometheus', name: 'Prom', isDefault: true }, { alerting: true }),
};

function renderModifyExport(ruleId: string) {
  render(
    <Routes>
      <Route path="/alerting/:id/modify-export" element={<GrafanaModifyExport />} />
    </Routes>,
    {
      historyOptions: { initialEntries: [`/alerting/${ruleId}/modify-export`] },
    }
  );
}

const server = setupMswServer();

describe('GrafanaModifyExport', () => {
  setupDataSources(dataSources.default);

  it('Should render edit form for the specified rule', async () => {
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
