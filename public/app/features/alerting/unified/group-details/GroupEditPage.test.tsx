import { HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { render, screen } from 'test/test-utils';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { locationService } from '@grafana/runtime';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { AccessControlAction } from 'app/types/accessControl';
import { RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import {
  mimirDataSource,
  setDeleteRulerRuleNamespaceResolver,
  setFolderResponse,
  setGrafanaRulerRuleGroupResolver,
  setRulerRuleGroupResolver,
  setUpdateGrafanaRulerRuleNamespaceResolver,
  setUpdateRulerRuleNamespaceResolver,
} from '../mocks/server/configure';
import { alertingFactory } from '../mocks/server/db';

import GroupEditPage from './GroupEditPage';

// Mock the useRuleGroupConsistencyCheck hook
jest.mock('../hooks/usePrometheusConsistencyCheck', () => ({
  ...jest.requireActual('../hooks/usePrometheusConsistencyCheck'),
  useRuleGroupConsistencyCheck: () => ({
    waitForGroupConsistency: jest.fn().mockResolvedValue(undefined),
  }),
}));

window.performance.mark = jest.fn();
window.performance.measure = jest.fn();

const ui = {
  header: byRole('heading', { level: 1 }),
  folderInput: byRole('textbox', { name: /Folder/ }),
  namespaceInput: byRole('textbox', { name: /Namespace/ }),
  nameInput: byRole('textbox', { name: /Evaluation group name/ }),
  intervalInput: byRole('textbox', { name: /Evaluation interval/ }),
  saveButton: byRole('button', { name: /Save/ }),
  cancelButton: byRole('link', { name: /Cancel/ }),
  deleteButton: byRole('button', { name: /Delete/ }),
  rules: byTestId('reorder-alert-rule'),
  successMessage: byText('Successfully updated the rule group'),
  errorMessage: byText('Failed to update rule group'),
  confirmDeleteModal: {
    dialog: byRole('dialog'),
    header: byRole('heading', { level: 2, name: /Delete rule group/ }),
    confirmButton: byRole('button', { name: /Delete/ }),
  },
};

setupMswServer();
grantUserPermissions([
  AccessControlAction.AlertingRuleRead,
  AccessControlAction.AlertingRuleUpdate,
  AccessControlAction.AlertingRuleExternalRead,
  AccessControlAction.AlertingRuleExternalWrite,
]);

const { dataSource: mimirDs } = mimirDataSource();

describe('GroupEditPage', () => {
  const group = alertingFactory.ruler.group.build({
    name: 'test-group-cpu',
    interval: '4m30s',
    rules: [
      alertingFactory.ruler.alertingRule.build({ alert: 'first-rule' }),
      alertingFactory.ruler.alertingRule.build({ alert: 'second-rule' }),
    ],
  });

  describe('Grafana Managed Rules', () => {
    const groupsByName = new Map<string, RulerRuleGroupDTO>([[group.name, group]]);

    beforeEach(() => {
      setGrafanaRulerRuleGroupResolver(async ({ params: { groupName, folderUid } }) => {
        if (groupsByName.has(groupName) && folderUid === 'test-folder-uid') {
          return HttpResponse.json(groupsByName.get(groupName));
        }
        return HttpResponse.json(null, { status: 404 });
      });
      setFolderResponse({ uid: 'test-folder-uid', canSave: true });
    });

    it('should render grafana rules group with form fields', async () => {
      renderGroupEditPage('grafana', 'test-folder-uid', 'test-group-cpu');

      const header = await ui.header.find();

      const folderInput = await ui.folderInput.find();
      const nameInput = await ui.nameInput.find();
      const intervalInput = await ui.intervalInput.find();
      const saveButton = await ui.saveButton.find();
      const cancelButton = await ui.cancelButton.find();
      const rules = await ui.rules.findAll();

      expect(header).toHaveTextContent('Edit rule group');
      expect(folderInput).toHaveAttribute('readonly', '');
      expect(nameInput).toHaveValue('test-group-cpu');
      expect(intervalInput).toHaveValue('4m30s');
      expect(saveButton).toBeInTheDocument();
      expect(cancelButton).toBeInTheDocument();
      expect(cancelButton).toHaveProperty(
        'href',
        'http://localhost/alerting/grafana/namespaces/test-folder-uid/groups/test-group-cpu/view'
      );
      expect(rules).toHaveLength(2);
      expect(rules[0]).toHaveTextContent('first-rule');
      expect(rules[1]).toHaveTextContent('second-rule');
      // Changing folder is not supported for Grafana Managed Rules
      expect(ui.namespaceInput.query()).not.toBeInTheDocument();
    });

    it('should save updated interval', async () => {
      setUpdateGrafanaRulerRuleNamespaceResolver(async ({ request }) => {
        const body = await request.json();
        if (body.interval === '1m20s') {
          return HttpResponse.json({}, { status: 202 });
        }

        return HttpResponse.json(null, { status: 400 });
      });

      const { user } = renderGroupEditPage('grafana', 'test-folder-uid', 'test-group-cpu');

      const intervalInput = await ui.intervalInput.find();
      const saveButton = await ui.saveButton.find();

      await user.clear(intervalInput);
      await user.type(intervalInput, '1m20s');

      await user.click(saveButton);

      expect(await ui.successMessage.find()).toBeInTheDocument();
    });

    it('should save a new group and remove the old when renaming', async () => {
      setUpdateGrafanaRulerRuleNamespaceResolver(async ({ request }) => {
        const body = await request.json();
        if (body.name === 'new-group-name') {
          groupsByName.set('new-group-name', body);
          return HttpResponse.json({}, { status: 202 });
        }

        return HttpResponse.json(null, { status: 400 });
      });

      const { user } = renderGroupEditPage('grafana', 'test-folder-uid', 'test-group-cpu');

      const nameInput = await ui.nameInput.find();
      const saveButton = await ui.saveButton.find();

      await user.clear(nameInput);
      await user.type(nameInput, 'new-group-name');

      await user.click(saveButton);

      expect(await ui.successMessage.find()).toBeInTheDocument();
      expect(locationService.getLocation().pathname).toBe(
        '/alerting/grafana/namespaces/test-folder-uid/groups/new-group-name/edit'
      );
    });
  });

  describe('Mimir Rules', () => {
    // Create a map to store groups by name
    const groupsByName = new Map<string, RulerRuleGroupDTO>([[group.name, group]]);

    beforeEach(() => {
      groupsByName.clear();
      groupsByName.set(group.name, group);

      setRulerRuleGroupResolver(async ({ params: { groupName } }) => {
        if (groupsByName.has(groupName)) {
          return HttpResponse.json(groupsByName.get(groupName));
        }
        return HttpResponse.json(null, { status: 404 });
      });

      setUpdateRulerRuleNamespaceResolver(async ({ request, params }) => {
        const body = await request.json();
        groupsByName.set(body.name, body);
        return HttpResponse.json({}, { status: 202 });
      });

      setDeleteRulerRuleNamespaceResolver(async ({ params: { groupName } }) => {
        if (groupsByName.has(groupName)) {
          groupsByName.delete(groupName);
        }
        return HttpResponse.json({ message: 'group does not exist' }, { status: 404 });
      });
    });

    it('should save updated interval', async () => {
      setUpdateRulerRuleNamespaceResolver(async ({ request }) => {
        const body = await request.json();
        if (body.interval === '2m') {
          return HttpResponse.json({}, { status: 202 });
        }

        return HttpResponse.json(null, { status: 400 });
      });

      const { user } = renderGroupEditPage(mimirDs.uid, 'test-mimir-namespace', 'test-group-cpu');

      const intervalInput = await ui.intervalInput.find();
      const saveButton = await ui.saveButton.find();

      await user.clear(intervalInput);
      await user.type(intervalInput, '2m');

      await user.click(saveButton);

      expect(await ui.successMessage.find()).toBeInTheDocument();
    });

    it('should save a new group and remove the old when changing the group name', async () => {
      const { user } = renderGroupEditPage(mimirDs.uid, 'test-mimir-namespace', 'test-group-cpu');

      const groupNameInput = await ui.nameInput.find();
      const saveButton = await ui.saveButton.find();

      await user.clear(groupNameInput);
      await user.type(groupNameInput, 'new-group-name');

      await user.click(saveButton);

      expect(await ui.successMessage.find()).toBeInTheDocument();
      expect(locationService.getLocation().pathname).toBe(
        '/alerting/mimir/namespaces/test-mimir-namespace/groups/new-group-name/edit'
      );
    });

    it('should save a new group and delete old one when changing the namespace', async () => {
      const { user } = renderGroupEditPage(mimirDs.uid, 'test-mimir-namespace', 'test-group-cpu');

      const namespaceInput = await ui.namespaceInput.find();
      const saveButton = await ui.saveButton.find();

      await user.clear(namespaceInput);
      await user.type(namespaceInput, 'new-namespace-name');

      await user.click(saveButton);

      expect(await ui.successMessage.find()).toBeInTheDocument();
      expect(locationService.getLocation().pathname).toBe(
        '/alerting/mimir/namespaces/new-namespace-name/groups/test-group-cpu/edit'
      );
    });

    it('should display confirmation modal before deleting a group', async () => {
      const { user } = renderGroupEditPage(mimirDs.uid, 'test-mimir-namespace', 'test-group-cpu');

      const deleteButton = await ui.deleteButton.find();

      await user.click(deleteButton);
      const confirmDialog = await ui.confirmDeleteModal.dialog.find();

      expect(confirmDialog).toBeInTheDocument();
      expect(ui.confirmDeleteModal.header.get(confirmDialog)).toBeInTheDocument();
      expect(ui.confirmDeleteModal.confirmButton.get(confirmDialog)).toBeInTheDocument();
    });
  });

  describe('Form error handling', () => {
    const groupsByName = new Map<string, RulerRuleGroupDTO>([[group.name, group]]);

    beforeEach(() => {
      setGrafanaRulerRuleGroupResolver(async ({ params: { groupName, folderUid } }) => {
        if (groupsByName.has(groupName) && folderUid === 'test-folder-uid') {
          return HttpResponse.json(groupsByName.get(groupName));
        }
        return HttpResponse.json(null, { status: 404 });
      });
      setFolderResponse({ uid: 'test-folder-uid', canSave: true });
    });

    it('should show validation error for empty group name', async () => {
      const { user } = renderGroupEditPage('grafana', 'test-folder-uid', 'test-group-cpu');

      const nameInput = await ui.nameInput.find();
      const saveButton = await ui.saveButton.find();

      await user.clear(nameInput);
      await user.click(saveButton);

      // Check for validation error message
      expect(screen.getByText('Group name is required')).toBeInTheDocument();
    });

    it('should show validation error for invalid interval', async () => {
      const { user } = renderGroupEditPage('grafana', 'test-folder-uid', 'test-group-cpu');

      const intervalInput = await ui.intervalInput.find();
      const saveButton = await ui.saveButton.find();

      await user.clear(intervalInput);
      await user.type(intervalInput, 'invalid');
      await user.click(saveButton);

      // The exact error message depends on your validation logic
      // This is a common pattern for testing validation errors
      expect(screen.getByText(/must be of format/i)).toBeInTheDocument();
    });

    it('should handle API error when saving fails', async () => {
      setUpdateGrafanaRulerRuleNamespaceResolver(async () => {
        return HttpResponse.json({ message: 'Failed to save rule group' }, { status: 500 });
      });

      const { user } = renderGroupEditPage('grafana', 'test-folder-uid', 'test-group-cpu');

      const intervalInput = await ui.intervalInput.find();
      const saveButton = await ui.saveButton.find();

      await user.clear(intervalInput);
      await user.type(intervalInput, '1m');
      await user.click(saveButton);

      expect(ui.successMessage.query()).not.toBeInTheDocument();
      expect(ui.errorMessage.query()).toBeInTheDocument();
    });
  });
});

function renderGroupEditPage(dsUid: string, namespaceId: string, groupName: string) {
  return render(
    <>
      <AppNotificationList />
      <Routes>
        <Route
          path="/alerting/:dataSourceUid/namespaces/:namespaceId/groups/:groupName/edit"
          element={<GroupEditPage />}
        />
      </Routes>
    </>,
    {
      historyOptions: { initialEntries: [`/alerting/${dsUid}/namespaces/${namespaceId}/groups/${groupName}/edit`] },
    }
  );
}
