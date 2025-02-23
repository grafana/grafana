import { HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { render } from 'test/test-utils';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { locationService } from '@grafana/runtime';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import {
  mimirDataSource,
  setFolderResponse,
  setGrafanaRulerRuleGroupResolver,
  setRulerRuleGroupResolver,
  setUpdateRulerRuleNamespaceResolver,
} from '../mocks/server/configure';
import { alertingFactory } from '../mocks/server/db';

import GroupEditPage from './GroupEditPage';

const ui = {
  header: byRole('heading', { level: 1 }),
  namespaceInput: byRole('textbox', { name: /Namespace/ }),
  nameInput: byRole('textbox', { name: /Evaluation group name/ }),
  intervalInput: byRole('textbox', { name: /Evaluation interval/ }),
  saveButton: byRole('button', { name: /Save/ }),
  rules: byTestId('reorder-alert-rule'),
  successMessage: byText('Successfully updated the rule group'),
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
    beforeEach(() => {
      setGrafanaRulerRuleGroupResolver(async ({ params: { groupName, folderUid } }) => {
        if (groupName === 'test-group-cpu' && folderUid === 'test-folder-uid') {
          return HttpResponse.json(group);
        }

        return HttpResponse.json(null, { status: 404 });
      });
      setFolderResponse({ uid: 'test-folder-uid', canSave: true });
    });

    it('should render grafana rules group with form fields', async () => {
      renderGroupEditPage('grafana', 'test-folder-uid', 'test-group-cpu');

      const header = await ui.header.find();

      const nameInput = await ui.nameInput.find();
      const intervalInput = await ui.intervalInput.find();
      const saveButton = await ui.saveButton.find();
      const rules = await ui.rules.findAll();

      expect(header).toHaveTextContent('Edit rule group');
      expect(nameInput).toHaveValue('test-group-cpu');
      expect(intervalInput).toHaveValue('4m30s');
      expect(saveButton).toBeInTheDocument();
      expect(rules).toHaveLength(2);
      expect(rules[0]).toHaveTextContent('first-rule');
      expect(rules[1]).toHaveTextContent('second-rule');
      // Changing folder is not supported for Grafana Managed Rules
      expect(ui.namespaceInput.query()).not.toBeInTheDocument();
    });

    it('should save updated interval', async () => {
      setUpdateRulerRuleNamespaceResolver(async ({ request }) => {
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
      setUpdateRulerRuleNamespaceResolver(async ({ request }) => {
        const body = await request.json();
        if (body.name === 'new-group-name') {
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
    it('should save a new group and remove the old when changing the namespace', async () => {
      setRulerRuleGroupResolver(async ({ params: { groupName, namespace } }) => {
        if (groupName === 'test-group-cpu' && namespace === 'test-mimir-namespace') {
          return HttpResponse.json(group);
        }

        return HttpResponse.json(null, { status: 404 });
      });
      setUpdateRulerRuleNamespaceResolver(async ({ request, params }) => {
        if (params.folderUid === 'new-namespace-name') {
          return HttpResponse.json({}, { status: 202 });
        }

        return HttpResponse.json(null, { status: 400 });
      });

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
  });
});

function renderGroupEditPage(dsUid: string, namespaceId: string, groupName: string) {
  return render(
    <>
      <AppNotificationList />
      <Routes>
        <Route path="/alerting/:sourceId/namespaces/:namespaceId/groups/:groupName/edit" element={<GroupEditPage />} />
      </Routes>
    </>,
    {
      historyOptions: { initialEntries: [`/alerting/${dsUid}/namespaces/${namespaceId}/groups/${groupName}/edit`] },
    }
  );
}
