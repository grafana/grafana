import { within } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockGrafanaPromAlertingRule } from '../../mocks';
import { grafanaRulerRule } from '../../mocks/grafanaRulerApi';

import { AlertRuleRowActions } from './AlertRuleRowActions';

const server = setupMswServer();

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
    expect(within(ui.silenceItem.get()).getByTestId('icon-bell-slash')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-spinner')).not.toBeInTheDocument();

    await user.click(ui.silenceItem.get());

    expect(await ui.silenceDrawer.find()).toBeInTheDocument();
  });

  it('spins the silence action while it works out whether the rule can be silenced', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingInstanceCreate]);
    // Hold the rule request open so the loading state stays put long enough to assert on.
    server.use(http.get('/api/ruler/grafana/api/v1/rule/:uid', () => delay('infinite')));

    const { user } = renderActions();

    await user.click(await ui.moreButton.find());

    const silenceItem = await ui.silenceItem.find();
    expect(silenceItem).toBeDisabled();
    expect(within(silenceItem).getByTestId('icon-spinner')).toBeInTheDocument();
  });

  it('keeps the silence action spinning while the ruler half of the rule is outstanding', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingInstanceCreate]);
    // A rule is fetched in two halves and matching one by UID needs the ruler half, so serving only
    // the Prometheus half must leave the action loading rather than claiming it is unavailable.
    server.use(
      http.get('/api/prometheus/grafana/api/v1/rules', () =>
        HttpResponse.json({
          status: 'success',
          data: {
            groups: [
              {
                name: grafanaRulerRule.grafana_alert.rule_group,
                file: 'test-folder-1',
                folderUid: grafanaRulerRule.grafana_alert.namespace_uid,
                interval: 60,
                rules: [
                  mockGrafanaPromAlertingRule({
                    uid: ruleUID,
                    name: grafanaRulerRule.grafana_alert.title,
                    folderUid: grafanaRulerRule.grafana_alert.namespace_uid,
                  }),
                ],
              },
            ],
          },
        })
      ),
      http.get('/api/ruler/grafana/api/v1/rule/:uid', () => delay('infinite'))
    );

    const { user } = renderActions();

    await user.click(await ui.moreButton.find());

    const silenceItem = await ui.silenceItem.find();
    expect(silenceItem).toBeDisabled();
    expect(within(silenceItem).getByTestId('icon-spinner')).toBeInTheDocument();
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

  it('says the rule could not be loaded instead of leaving the action silently unavailable', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingInstanceCreate]);
    server.use(
      http.get('/api/ruler/grafana/api/v1/rule/:uid', () => HttpResponse.json({ message: 'boom' }, { status: 500 }))
    );

    const { user } = renderActions();

    await user.click(await ui.moreButton.find());

    await waitFor(() => {
      expect(screen.getByText(/could not load this alert rule/i)).toBeInTheDocument();
    });
    expect(ui.silenceItem.get()).toBeDisabled();
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
