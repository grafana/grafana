import 'core-js/stable/structured-clone';
import type { JSX } from 'react';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { render, screen, waitFor } from 'test/test-utils';
import { byRole, byTestId } from 'testing-library-selector';

import { AccessControlAction } from 'app/types/accessControl';

import { mockAlertRuleApi, setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';

import ReceiverModifyExport from './ReceiverModifyExport';

const server = setupMswServer();

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: ({ value }: { value: string }) => <textarea data-testid="code-editor" value={value} readOnly />,
}));

jest.mock(
  'react-virtualized-auto-sizer',
  () =>
    ({ children }: { children: ({ height, width }: { height: number; width: number }) => JSX.Element }) =>
      children({ height: 500, width: 400 })
);

const exportDrawer = {
  dialog: byRole('dialog', { name: /Export/ }),
  yamlTab: byRole('tab', { name: /YAML/ }),
  editor: byTestId('code-editor'),
};

const renderModifyExport = (contactPointUid: string) =>
  render(
    <Routes>
      <Route path="/alerting/notifications/receivers/:name/modify-export" element={<ReceiverModifyExport />} />
    </Routes>,
    {
      historyOptions: { initialEntries: [`/alerting/notifications/receivers/${contactPointUid}/modify-export`] },
    }
  );

beforeEach(() => {
  grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);
});

describe('ReceiverModifyExport', () => {
  it('Should render edit form for the specified contact point', async () => {
    mockAlertRuleApi(server).modifyExportReceiver({
      hcl: 'HCL Export Content',
      yaml: 'Yaml Export Content',
    });

    const { user } = renderModifyExport('lotsa-emails');

    expect(await screen.findByRole('textbox', { name: 'Name *' })).toHaveValue('lotsa-emails');

    await user.click(await screen.findByRole('button', { name: 'Export' }));

    const drawer = await exportDrawer.dialog.find();
    expect(drawer).toBeInTheDocument();

    expect(exportDrawer.yamlTab.get(drawer)).toHaveAttribute('aria-selected', 'true');

    await waitFor(() => {
      expect(exportDrawer.editor.get(drawer)).toHaveTextContent('Yaml Export Content');
    });
  });
});
