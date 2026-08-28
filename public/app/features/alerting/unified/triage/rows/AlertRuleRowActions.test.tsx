import { within } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { selectors } from '@grafana/e2e-selectors';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockFolder, mockGrafanaPromAlertingRule } from '../../mocks';
import { grafanaRulerRule } from '../../mocks/grafanaRulerApi';
import { getFolderHandler } from '../../mocks/server/handlers/folders';

import { AlertRuleRowActions } from './AlertRuleRowActions';

const server = setupMswServer();

const ui = {
  actionsButton: byRole('button', { name: /Actions for CPU too high/ }),
  menu: byRole('menu'),
  spinner: byRole('status', { name: /Loading/ }),
  silenceItem: byRole('menuitem', { name: /Silence notifications/ }),
  viewRuleItem: byRole('menuitem', { name: /View alert rule/ }),
  silenceDrawer: byRole('dialog', { name: /Silence alert rule/ }),
};

/** While the menu is open the focus manager hides the rest of the page from the a11y tree, so the
 * trigger has to be found by test id rather than by role. */
const actionsButtonTestId = selectors.pages.Alerting.Triage.ruleActionsButton;

const ruleUID = grafanaRulerRule.grafana_alert.uid;
const folderUID = grafanaRulerRule.grafana_alert.namespace_uid;

function renderActions(uid = ruleUID) {
  return render(<AlertRuleRowActions ruleUID={uid} ruleName="CPU too high" />);
}

/** Records the requests opening a menu causes. */
function watchRuleLookups() {
  const urls: string[] = [];
  server.events.on('request:start', ({ request }) => {
    if (/\/api\/(ruler|prometheus)\/grafana\/api\/v1\/rule/.test(request.url)) {
      urls.push(new URL(request.url).pathname);
    }
  });
  return urls;
}

/** A user who may only silence rules in this rule's folder, so the permission check has to load. */
function grantFolderScopedSilence(uids: string[] = [ruleUID], responseDelay = 0) {
  grantUserPermissions([AccessControlAction.AlertingRuleRead]);
  server.use(
    http.get('/api/prometheus/grafana/api/v1/rules', async () => {
      if (responseDelay) {
        await delay(responseDelay);
      }
      return HttpResponse.json({
        status: 'success',
        data: {
          groups: [
            {
              name: grafanaRulerRule.grafana_alert.rule_group,
              file: 'Folder A',
              folderUid: folderUID,
              interval: 60,
              rules: uids.map((uid) => mockGrafanaPromAlertingRule({ uid, name: `rule-${uid}` })),
            },
          ],
        },
      });
    }),
    getFolderHandler(
      mockFolder({
        uid: folderUID,
        title: 'Folder A',
        accessControl: { [AccessControlAction.AlertingSilenceCreate]: true },
      })
    )
  );
}

afterEach(() => {
  server.events.removeAllListeners();
});

describe('AlertRuleRowActions', () => {
  it('shows a spinner and no items at all while it works out whether the rule can be silenced', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
    server.use(http.get('/api/prometheus/grafana/api/v1/rules', () => delay('infinite')));
    const { user } = renderActions();

    await user.click(await ui.actionsButton.find());

    expect(await ui.spinner.find()).toBeInTheDocument();
    // Adding the silence item once it resolves would shift everything under it, so nothing is
    // rendered until we know.
    expect(ui.silenceItem.query()).not.toBeInTheDocument();
    expect(ui.viewRuleItem.query()).not.toBeInTheDocument();
  });

  it('swaps the spinner for the items without ever replacing the menu', async () => {
    grantFolderScopedSilence([ruleUID], 100);
    const { user } = renderActions();

    const button = await ui.actionsButton.find();
    await user.click(button);

    const menuWhileLoading = await ui.menu.find();
    expect(within(menuWhileLoading).getByRole('status', { name: /Loading/ })).toBeInTheDocument();

    // Found *within* the very same element, so the menu was updated in place rather than being
    // torn down and rebuilt somewhere else.
    await waitFor(() => {
      expect(within(menuWhileLoading).getByRole('menuitem', { name: /Silence notifications/ })).toBeInTheDocument();
    });
    expect(ui.menu.get()).toBe(menuWhileLoading);
    // The trigger survives too, so the Dropdown around it was never re-created either.
    expect(screen.getByTestId(actionsButtonTestId)).toBe(button);
    expect(ui.spinner.query()).not.toBeInTheDocument();
  });

  it('asks the server nothing until someone opens a menu', async () => {
    grantFolderScopedSilence();
    const lookups = watchRuleLookups();

    const { user } = renderActions();

    expect(await ui.actionsButton.find()).toBeInTheDocument();
    expect(lookups).toEqual([]);

    await user.click(ui.actionsButton.get());
    await waitFor(() => {
      expect(ui.silenceItem.get()).toBeInTheDocument();
    });
    expect(lookups).toEqual(['/api/prometheus/grafana/api/v1/rules']);
  });

  it('reuses one lookup across menus opened for different rules', async () => {
    const uids = ['rule-a', 'rule-b', 'rule-c'];
    grantFolderScopedSilence(uids);
    const lookups = watchRuleLookups();

    const { user } = render(
      <>
        {uids.map((uid) => (
          <AlertRuleRowActions key={uid} ruleUID={uid} ruleName={uid} />
        ))}
      </>
    );

    for (const uid of uids) {
      await user.click(await screen.findByRole('button', { name: `Actions for ${uid}` }));
      await waitFor(() => {
        expect(ui.silenceItem.get()).toBeInTheDocument();
      });
      await user.keyboard('{Escape}');
    }

    expect(lookups).toEqual(['/api/prometheus/grafana/api/v1/rules']);
  });

  it('makes no request at all for a user who can silence across the whole org', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingInstanceCreate]);
    const lookups = watchRuleLookups();
    const { user } = renderActions();

    await user.click(await ui.actionsButton.find());

    // No loading step either - the org-wide permission answers this outright.
    expect(await ui.silenceItem.find()).toBeInTheDocument();
    expect(ui.spinner.query()).not.toBeInTheDocument();
    expect(lookups).toEqual([]);
  });

  it('opens the silence editor from the menu', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingInstanceCreate]);
    const { user } = renderActions();

    await user.click(await ui.actionsButton.find());
    await user.click(await ui.silenceItem.find());

    expect(await ui.silenceDrawer.find()).toBeInTheDocument();
  });

  it('leaves the silence item out for a user who cannot create silences', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
    const { user } = renderActions();

    await user.click(await ui.actionsButton.find());

    expect(await ui.viewRuleItem.find()).toBeInTheDocument();
    expect(ui.silenceItem.query()).not.toBeInTheDocument();
  });

  it('links to the full rule page in a new tab so the list and its filters stay put', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingInstanceCreate]);
    const { user } = renderActions();

    await user.click(await ui.actionsButton.find());

    const viewRule = await ui.viewRuleItem.find();
    expect(viewRule).toHaveAttribute('href', `/alerting/grafana/${ruleUID}/view`);
    expect(viewRule).toHaveAttribute('target', '_blank');
  });
});
