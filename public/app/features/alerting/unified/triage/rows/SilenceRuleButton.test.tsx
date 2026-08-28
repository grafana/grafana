import { HttpResponse, http } from 'msw';
import { render, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockFolder, mockGrafanaPromAlertingRule } from '../../mocks';
import { grafanaRulerRule } from '../../mocks/grafanaRulerApi';
import { getFolderHandler } from '../../mocks/server/handlers/folders';

import { SilenceRuleButton } from './SilenceRuleButton';

const server = setupMswServer();

const ui = {
  silenceButton: byRole('button', { name: /Silence notifications/ }),
  silenceDrawer: byRole('dialog', { name: /Silence alert rule/ }),
};

const ruleUID = grafanaRulerRule.grafana_alert.uid;

function renderButton() {
  return render(<SilenceRuleButton ruleUID={ruleUID} />);
}

/** Records the requests this button causes, so we can assert how many a list of rows would make. */
function watchRuleLookups() {
  const urls: string[] = [];
  server.events.on('request:start', ({ request }) => {
    if (/\/api\/(ruler|prometheus)\/grafana\/api\/v1\/rule/.test(request.url)) {
      urls.push(new URL(request.url).pathname);
    }
  });
  return urls;
}

/** Serves the given rules so their folder can be found, the way the real bulk endpoint would. */
function servePromRules(uids: string[] = [ruleUID]) {
  server.use(
    http.get('/api/prometheus/grafana/api/v1/rules', () =>
      HttpResponse.json({
        status: 'success',
        data: {
          groups: [
            {
              name: grafanaRulerRule.grafana_alert.rule_group,
              file: 'Folder A',
              folderUid: grafanaRulerRule.grafana_alert.namespace_uid,
              interval: 60,
              rules: uids.map((uid) => mockGrafanaPromAlertingRule({ uid, name: `rule-${uid}` })),
            },
          ],
        },
      })
    )
  );
}

afterEach(() => {
  server.events.removeAllListeners();
});

describe('SilenceRuleButton', () => {
  it('asks the server nothing for a user who can silence across the whole org', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingInstanceCreate]);
    const lookups = watchRuleLookups();

    renderButton();

    expect(await ui.silenceButton.find()).toBeInTheDocument();
    // The org-wide permission already answers this, so looking the rule up couldn't change it.
    expect(lookups).toEqual([]);
  });

  it('opens the silence editor without leaving the list', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingInstanceCreate]);
    const { user } = renderButton();

    await user.click(await ui.silenceButton.find());

    expect(await ui.silenceDrawer.find()).toBeInTheDocument();
  });

  it('shows nothing at all for a user who cannot create silences', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
    renderButton();

    // Give the folder lookup time to arrive and (wrongly) grant permission.
    await waitFor(() => {
      expect(ui.silenceButton.query()).not.toBeInTheDocument();
    });
    expect(ui.silenceButton.query()).not.toBeInTheDocument();
  });

  it('appears for a user who may only silence rules in this rule’s folder', async () => {
    // No org-wide silence permission — the only thing that can grant this is the folder itself,
    // which is why the button has to look up which folder the rule lives in.
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
    servePromRules();
    server.use(
      getFolderHandler(
        mockFolder({
          uid: grafanaRulerRule.grafana_alert.namespace_uid,
          title: 'Folder A',
          accessControl: { [AccessControlAction.AlertingSilenceCreate]: true },
        })
      )
    );

    renderButton();

    expect(await ui.silenceButton.find()).toBeInTheDocument();
  });

  it('looks the rules up once for the whole list, not once per row', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
    // Five *different* rules, so a per-rule lookup couldn't be mistaken for a shared one.
    const uids = ['rule-a', 'rule-b', 'rule-c', 'rule-d', 'rule-e'];
    servePromRules(uids);
    server.use(
      getFolderHandler(
        mockFolder({
          uid: grafanaRulerRule.grafana_alert.namespace_uid,
          title: 'Folder A',
          accessControl: { [AccessControlAction.AlertingSilenceCreate]: true },
        })
      )
    );
    const lookups = watchRuleLookups();

    render(
      <>
        {uids.map((uid) => (
          <SilenceRuleButton key={uid} ruleUID={uid} />
        ))}
      </>
    );

    await waitFor(() => {
      expect(ui.silenceButton.getAll()).toHaveLength(5);
    });
    expect(lookups).toEqual(['/api/prometheus/grafana/api/v1/rules']);
  });

  it('stays hidden when the rule lookup fails, rather than offering a silence that cannot be made', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
    server.use(
      http.get('/api/prometheus/grafana/api/v1/rules', () => HttpResponse.json({ message: 'boom' }, { status: 500 }))
    );

    renderButton();

    await waitFor(() => {
      expect(ui.silenceButton.query()).not.toBeInTheDocument();
    });
  });
});
