import { render, screen, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { grafanaRulerRule } from '../../mocks/grafanaRulerApi';

import { AlertRuleRowActions } from './AlertRuleRowActions';

setupMswServer();

const ui = {
  moreButton: byRole('button', { name: /More actions for CPU too high/ }),
  silenceItem: byRole('menuitem', { name: /Silence notifications/ }),
  viewRuleItem: byRole('menuitem', { name: /View alert rule/ }),
  silenceDrawer: byRole('dialog', { name: /Silence alert rule/ }),
};

const ruleUID = grafanaRulerRule.grafana_alert.uid;

function renderActions() {
  return render(<AlertRuleRowActions ruleUID={ruleUID} ruleName="CPU too high" />);
}

describe('AlertRuleRowActions', () => {
  it('opens the silence editor from the list, without going through the rule details first', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingInstanceCreate]);
    const { user } = renderActions();

    await user.click(await ui.moreButton.find());

    // The item starts out disabled while we fetch the rule to find out whether this user may
    // silence it, so wait for that to settle before clicking.
    await waitFor(() => {
      expect(ui.silenceItem.get()).toBeEnabled();
    });
    await user.click(ui.silenceItem.get());

    expect(await ui.silenceDrawer.find()).toBeInTheDocument();
  });

  it('keeps the silence action disabled for a user who cannot create silences', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
    const { user } = renderActions();

    await user.click(await ui.moreButton.find());

    const silenceItem = await ui.silenceItem.find();
    expect(silenceItem).toBeDisabled();
    expect(screen.getByText(/do not have permission to create silences/i)).toBeInTheDocument();

    // Give the rule fetch a chance to enable the item, in case the permission check is wrong.
    await waitFor(() => {
      expect(ui.silenceItem.get()).toBeDisabled();
    });
    expect(ui.silenceDrawer.query()).not.toBeInTheDocument();
  });

  it('links to the full rule page in a new tab so the list and its filters stay put', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
    const { user } = renderActions();

    await user.click(await ui.moreButton.find());

    const viewRule = await ui.viewRuleItem.find();
    expect(viewRule).toHaveAttribute('href', `/alerting/grafana/${ruleUID}/view`);
    expect(viewRule).toHaveAttribute('target', '_blank');
  });
});
