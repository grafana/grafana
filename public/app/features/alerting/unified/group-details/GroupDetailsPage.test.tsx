import { HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { Props } from 'react-virtualized-auto-sizer';
import { render, screen, waitFor } from 'test/test-utils';
import { byRole, byTestId } from 'testing-library-selector';

import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions, mockRulerGrafanaRule, mockRulerRuleGroup } from '../mocks';
import {
  mimirDataSource,
  setFolderResponse,
  setGrafanaRuleGroupExportResolver,
  setPrometheusRules,
  setRulerRuleGroupHandler,
  setRulerRuleGroupResolver,
} from '../mocks/server/configure';
import { alertingFactory } from '../mocks/server/db';

import GroupDetailsPage from './GroupDetailsPage';

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
  header: byRole('heading', { level: 1 }),
  editLink: byRole('link', { name: 'Edit' }),
  exportButton: byRole('button', { name: 'Export' }),
  tableRow: byTestId('row'),
  rowsTable: byTestId('dynamic-table'),
  export: {
    dialog: byRole('dialog', { name: /Drawer title Export .* rules/ }),
    jsonTab: byRole('tab', { name: /JSON/ }),
    yamlTab: byRole('tab', { name: /YAML/ }),
    editor: byTestId('code-editor'),
    copyCodeButton: byRole('button', { name: 'Copy code' }),
    downloadButton: byRole('button', { name: 'Download' }),
  },
};

setupMswServer();

describe('GroupDetailsPage', () => {
  beforeEach(() => {
    grantUserPermissions([
      AccessControlAction.AlertingRuleRead,
      AccessControlAction.AlertingRuleUpdate,
      AccessControlAction.AlertingRuleExternalRead,
      AccessControlAction.AlertingRuleExternalWrite,
    ]);
  });

  describe('Grafana managed rules', () => {
    const rule1 = mockRulerGrafanaRule({ for: '10m' }, { title: 'High CPU Usage' });
    const rule2 = mockRulerGrafanaRule({ for: '5m' }, { title: 'Memory Pressure' });
    const provisionedRule = mockRulerGrafanaRule({ for: '10m' }, { title: 'Provisioned Rule', provenance: 'api' });

    const group = mockRulerRuleGroup({
      name: 'test-group-cpu',
      interval: '3m',
      rules: [rule1, rule2],
    });

    const provisionedGroup = mockRulerRuleGroup({
      name: 'provisioned-group-cpu',
      interval: '15m',
      rules: [provisionedRule],
    });

    beforeEach(() => {
      setRulerRuleGroupHandler({ response: HttpResponse.json(group) });
      setFolderResponse({ uid: 'test-folder-uid', canSave: true, title: 'test-folder-title' });
      setGrafanaRuleGroupExportResolver(({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.text(
          url.searchParams.get('format') === 'yaml' ? 'Yaml Export Content' : 'Json Export Content'
        );
      });
    });

    it('should render grafana rules group based on the Ruler API', async () => {
      // Act
      renderGroupDetailsPage('grafana', 'test-folder-uid', group.name);

      const header = await ui.header.find();
      const editLink = await ui.editLink.find();

      // Assert
      expect(header).toHaveTextContent('test-group-cpu');
      expect(await screen.findByRole('link', { name: /test-folder-title/ })).toBeInTheDocument();
      expect(await screen.findByText(/5m/)).toBeInTheDocument();
      expect(editLink).toHaveAttribute(
        'href',
        '/alerting/grafana/namespaces/test-folder-uid/groups/test-group-cpu/edit?returnTo=%2Falerting%2Fgrafana%2Fnamespaces%2Ftest-folder-uid%2Fgroups%2Ftest-group-cpu%2Fview'
      );

      const tableRows = await ui.tableRow.findAll(await ui.rowsTable.find());
      expect(tableRows).toHaveLength(2);

      expect(tableRows[0]).toHaveTextContent('High CPU Usage');
      expect(tableRows[0]).toHaveTextContent('10m');
      expect(tableRows[0]).toHaveTextContent('5');

      expect(tableRows[1]).toHaveTextContent('Memory Pressure');
      expect(tableRows[1]).toHaveTextContent('5m');
      expect(tableRows[1]).toHaveTextContent('3');
    });

    it('should render error alert when API returns an error', async () => {
      // Mock an error response from the API
      setRulerRuleGroupResolver((req) => {
        return HttpResponse.json({ error: 'Failed to fetch rule group' }, { status: 500 });
      });

      // Act
      renderGroupDetailsPage('grafana', 'test-folder-uid', group.name);

      // Assert
      expect(await screen.findByText('Error loading the group')).toBeInTheDocument();
      expect(await screen.findByText('Failed to fetch rule group')).toBeInTheDocument();
    });

    it('should render "not found" when group does not exist', async () => {
      // Mock a 404 response
      setRulerRuleGroupResolver((req) => {
        return HttpResponse.json({ error: 'rule group does not exist' }, { status: 404 });
      });

      // Act
      renderGroupDetailsPage('grafana', 'test-folder-uid', 'non-existing-group');

      const notFoundAlert = await screen.findByRole('alert', { name: /Error loading the group/ });

      // Assert
      expect(notFoundAlert).toBeInTheDocument();
      expect(notFoundAlert).toHaveTextContent(/rule group does not exist/);
      expect(screen.getByTestId('data-testid entity-not-found')).toHaveTextContent(
        'test-folder-uid/non-existing-group'
      );
    });

    it('should not show edit button when user lacks edit permissions', async () => {
      // Remove edit permissions
      grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleExternalRead]);

      // Act
      renderGroupDetailsPage('grafana', 'test-folder-uid', group.name);

      const tableRows = await ui.tableRow.findAll(await ui.rowsTable.find());

      // Assert
      expect(tableRows).toHaveLength(2);
      expect(ui.editLink.query()).not.toBeInTheDocument(); // Edit button should not be present
    });

    it('should not show edit button when folder cannot be saved', async () => {
      setFolderResponse({ uid: 'test-folder-uid', canSave: false });

      // Act
      renderGroupDetailsPage('grafana', 'test-folder-uid', group.name);

      const tableRows = await ui.tableRow.findAll(await ui.rowsTable.find());

      // Assert
      expect(tableRows).toHaveLength(2);
      expect(ui.editLink.query()).not.toBeInTheDocument(); // Edit button should not be present
    });

    it('should not allow editing if the group is provisioned', async () => {
      setRulerRuleGroupHandler({ response: HttpResponse.json(provisionedGroup) });

      // Act
      renderGroupDetailsPage('grafana', 'test-folder-uid', provisionedGroup.name);

      const tableRows = await ui.tableRow.findAll(await ui.rowsTable.find());

      // Assert
      expect(tableRows).toHaveLength(1);
      expect(tableRows[0]).toHaveTextContent('Provisioned Rule');
      expect(ui.editLink.query()).not.toBeInTheDocument();
      expect(ui.exportButton.query()).toBeInTheDocument();
    });

    it('should allow exporting groups', async () => {
      // Act
      const { user } = renderGroupDetailsPage('grafana', 'test-folder-uid', group.name);

      // Assert
      const exportButton = await ui.exportButton.find();
      expect(exportButton).toBeInTheDocument();

      await user.click(exportButton);

      const drawer = await ui.export.dialog.find();

      expect(ui.export.yamlTab.get(drawer)).toHaveAttribute('aria-selected', 'true');
      await waitFor(() => {
        expect(ui.export.editor.get(drawer)).toHaveTextContent('Yaml Export Content');
      });

      await user.click(ui.export.jsonTab.get(drawer));
      await waitFor(() => {
        expect(ui.export.editor.get(drawer)).toHaveTextContent('Json Export Content');
      });

      expect(ui.export.copyCodeButton.get(drawer)).toBeInTheDocument();
      expect(ui.export.downloadButton.get(drawer)).toBeInTheDocument();
    });
  });

  describe('Prometheus rules', () => {
    it('should render vanilla prometheus rules group', async () => {
      const promDs = alertingFactory.dataSource.build({ uid: 'prometheus', name: 'Prometheus' });
      const group = alertingFactory.prometheus.group.build({ name: 'test-group-cpu', interval: 500 });
      setPrometheusRules({ uid: promDs.uid }, [group]);

      // Act
      renderGroupDetailsPage(promDs.uid, 'test-prom-namespace', 'test-group-cpu');

      // Assert
      const header = await ui.header.find();

      expect(header).toHaveTextContent('test-group-cpu');
      expect(await screen.findByText(/test-group-cpu/)).toBeInTheDocument();
      expect(await screen.findByText(/8m20s/)).toBeInTheDocument();
      expect(ui.editLink.query()).not.toBeInTheDocument();
      expect(ui.exportButton.query()).not.toBeInTheDocument();
    });
  });

  describe('Mimir rules', () => {
    it('should render mimir rules group', async () => {
      const { dataSource: mimirDs } = mimirDataSource();

      const group = alertingFactory.ruler.group.build({ name: 'test-group-cpu', interval: '11m40s' });
      setRulerRuleGroupResolver((req) => {
        if (req.params.namespace === 'test-mimir-namespace' && req.params.groupName === 'test-group-cpu') {
          return HttpResponse.json(group);
        }
        return HttpResponse.json({ error: 'Group not found' }, { status: 404 });
      });

      renderGroupDetailsPage(mimirDs.uid, 'test-mimir-namespace', 'test-group-cpu');

      const header = await ui.header.find();
      const editLink = await ui.editLink.find();

      expect(header).toHaveTextContent('test-group-cpu');
      expect(await screen.findByText(/test-mimir-namespace/)).toBeInTheDocument();
      expect(await screen.findByText(/11m40s/)).toBeInTheDocument();
      expect(editLink).toHaveAttribute(
        'href',
        `/alerting/mimir/namespaces/test-mimir-namespace/groups/test-group-cpu/edit?returnTo=%2Falerting%2Fmimir%2Fnamespaces%2Ftest-mimir-namespace%2Fgroups%2Ftest-group-cpu%2Fview`
      );
      expect(ui.exportButton.query()).not.toBeInTheDocument();
    });
  });
});

function renderGroupDetailsPage(dsUid: string, namespaceId: string, groupName: string) {
  return render(
    <Routes>
      <Route
        path="/alerting/:dataSourceUid/namespaces/:namespaceId/groups/:groupName/view"
        element={<GroupDetailsPage />}
      />
    </Routes>,
    {
      historyOptions: { initialEntries: [`/alerting/${dsUid}/namespaces/${namespaceId}/groups/${groupName}/view`] },
    }
  );
}
