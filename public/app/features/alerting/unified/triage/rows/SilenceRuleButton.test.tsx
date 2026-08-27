import { HttpResponse, http } from 'msw';
import { render, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockFolder } from '../../mocks';
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

describe('SilenceRuleButton', () => {
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

  it('stays hidden when the rule lookup fails, rather than offering a silence that cannot be made', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
    server.use(
      http.get('/api/ruler/grafana/api/v1/rule/:uid', () => HttpResponse.json({ message: 'boom' }, { status: 500 }))
    );

    renderButton();

    await waitFor(() => {
      expect(ui.silenceButton.query()).not.toBeInTheDocument();
    });
  });
});
