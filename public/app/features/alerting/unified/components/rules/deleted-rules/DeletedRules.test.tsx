import { render, screen } from 'test/test-utils';

import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { DashboardSearchItemType } from 'app/features/search/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../../mockApi';
import { mockFolder } from '../../../mocks';
import { grafanaRulerRule } from '../../../mocks/grafanaRulerApi';
import { setFolderResponse } from '../../../mocks/server/configure';
import { grantPermissionsHelper } from '../../../test/test-utils';

import { DeletedRules } from './DeletedRules';

setupMswServer();
describe('render Deleted rules page', () => {
  grantPermissionsHelper([
    AccessControlAction.AlertingRuleCreate,
    AccessControlAction.AlertingRuleRead,
    AccessControlAction.AlertingRuleUpdate,
    AccessControlAction.AlertingRuleDelete,
    AccessControlAction.AlertingInstanceCreate,
  ]);
  it('should show recently deleted rules, and restore button', async () => {
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

    const { user } = render(
      <>
        <AppNotificationList />
        <DeletedRules deletedRules={[grafanaRulerRule]} />
      </>
    );
    expect(screen.getByText('Grafana-rule')).toBeInTheDocument();

    const restoreButtons = screen.getAllByRole('button', { name: /restore/i });
    await user.click(restoreButtons[0]);
    expect(
      screen.getByText(/are you sure you want to restore this deleted alert rule definition\?/i)
    ).toBeInTheDocument();

    await user.click(screen.getByText(/yes, restore deleted rule/i));
    expect(await screen.findByRole('status')).toHaveTextContent('Rule added successfully');
  });
});
