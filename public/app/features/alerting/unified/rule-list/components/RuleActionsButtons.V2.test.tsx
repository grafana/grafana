import { render, userEvent } from 'test/test-utils';
import { byLabelText, byRole } from 'testing-library-selector';

import { setPluginLinksHook } from '@grafana/runtime';
import { mockFolderApi, setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions, mockFolder, mockGrafanaPromAlertingRule } from 'app/features/alerting/unified/mocks';
import { setFolderAccessControl } from 'app/features/alerting/unified/mocks/server/configure';
import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { AccessControlAction } from 'app/types/accessControl';

import { RuleActionsButtons } from './RuleActionsButtons.V2';

jest.mock('@grafana/assistant', () => ({
  useAssistant: () => ({ isAvailable: false, openAssistant: jest.fn() }),
}));

const server = setupMswServer();

setPluginLinksHook(() => ({ links: [], isLoading: false }));

setupDataSources();

const ui = {
  editButton: byRole('link', { name: /Edit/ }),
  moreButton: byLabelText(/More/),
  menu: byRole('menu'),
  pauseItem: byRole('menuitem', { name: /Pause evaluation/i }),
};

const groupIdentifier = {
  groupOrigin: 'grafana' as const,
  namespace: { uid: 'NAMESPACE_UID' },
  groupName: 'my-group',
};

describe('RuleActionsButtons (v2)', () => {
  it('opens the menu on ability data the row already loaded, with the first item focused', async () => {
    const user = userEvent.setup();
    const accessControl = {
      [AccessControlAction.AlertingRuleRead]: true,
      [AccessControlAction.AlertingRuleUpdate]: true,
      [AccessControlAction.AlertingRuleDelete]: true,
      [AccessControlAction.AlertingSilenceCreate]: true,
      [AccessControlAction.FoldersRead]: true,
    };
    grantUserPermissions([
      AccessControlAction.AlertingRuleRead,
      AccessControlAction.AlertingRuleUpdate,
      AccessControlAction.AlertingRuleDelete,
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.AlertingInstanceCreate,
      AccessControlAction.FoldersRead,
    ]);
    setFolderAccessControl(accessControl);
    mockFolderApi(server).folder('NAMESPACE_UID', mockFolder({ uid: 'NAMESPACE_UID', accessControl }));
    const requests = await captureRequests();
    // Plugin settings are left out: "Declare incident" fetches its own whenever the menu opens
    const abilityPaths = () =>
      requests.map((request) => new URL(request.url).pathname).filter((path) => !path.startsWith('/api/plugins/'));

    render(<RuleActionsButtons promRule={mockGrafanaPromAlertingRule()} groupIdentifier={groupIdentifier} compact />);
    await ui.editButton.find();
    const pathsBeforeOpen = abilityPaths();

    await user.click(await ui.moreButton.find());
    await ui.menu.find();

    expect(pathsBeforeOpen).toContain('/api/v1/ngalert');
    expect(abilityPaths()).toEqual(pathsBeforeOpen);
    expect(ui.pauseItem.get()).toHaveFocus();
  });
});
