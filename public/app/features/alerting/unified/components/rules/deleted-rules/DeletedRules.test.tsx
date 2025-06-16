import { produce } from 'immer';
import { render, screen } from 'test/test-utils';

import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { DashboardSearchItemType } from 'app/features/search/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../../mockApi';
import { grantUserRole, mockFolder } from '../../../mocks';
import { grafanaRulerRule } from '../../../mocks/grafanaRulerApi';
import { setFolderResponse } from '../../../mocks/server/configure';
import { grantPermissionsHelper, testWithFeatureToggles } from '../../../test/test-utils';

import { DeletedRules } from './DeletedRules';

setupMswServer();
testWithFeatureToggles(['alertingRulePermanentlyDelete', 'alertingRuleRecoverDeleted', 'alertRuleRestore']);
beforeEach(() => {
  grantUserRole('Admin');
  grantPermissionsHelper([
    AccessControlAction.AlertingRuleCreate,
    AccessControlAction.AlertingRuleRead,
    AccessControlAction.AlertingRuleUpdate,
    AccessControlAction.AlertingRuleDelete,
    AccessControlAction.AlertingInstanceCreate,
  ]);
});

function renderDeletedRules() {
  const folder = {
    title: 'Folder A',
    uid: grafanaRulerRule.grafana_alert.namespace_uid,
    id: 1,
    type: DashboardSearchItemType.DashDB,
    accessControl: {
      [AccessControlAction.AlertingRuleUpdate]: true,
    },
  };
  setFolderResponse(mockFolder(folder));
  const deletedRule = produce(grafanaRulerRule, (draft) => {
    draft.grafana_alert.guid = '1234';
  });

  return render(
    <>
      <AppNotificationList />
      <DeletedRules deletedRules={[deletedRule]} />
    </>
  );
}
describe('render Deleted rules page', () => {
  it('should show recently deleted rules', async () => {
    renderDeletedRules();
    expect(screen.getByText('Grafana-rule')).toBeInTheDocument();
  });

  it('should render restore button', async () => {
    const { user } = renderDeletedRules();
    const restoreButtons = screen.getAllByRole('button', { name: /restore/i });
    await user.click(restoreButtons[0]);
    expect(
      screen.getByText(/are you sure you want to restore this deleted alert rule definition\?/i)
    ).toBeInTheDocument();

    await user.click(screen.getByText(/yes, restore deleted rule/i));
    expect(await screen.findByRole('status')).toHaveTextContent('Rule added successfully');
  });

  it('should render permanently delete button', async () => {
    const { user } = renderDeletedRules();
    const restoreButtons = screen.getAllByRole('button', { name: /permanently delete/i });
    await user.click(restoreButtons[0]);
    expect(
      screen.getByText(/are you sure you want to permanently delete this alert rule\? this action cannot be undone./i)
    ).toBeInTheDocument();

    await user.click(screen.getByText(/yes, permanently delete/i));
    expect(await screen.findByRole('status')).toHaveTextContent('Alert rule permanently deleted');
  });
});
