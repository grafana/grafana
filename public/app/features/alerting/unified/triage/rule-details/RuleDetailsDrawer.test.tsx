import { within } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setReturnToPreviousHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { grafanaRulerRule } from '../../mocks/grafanaRulerApi';

import { RuleDetailsDrawer } from './RuleDetailsDrawer';

const server = setupMswServer();

// The drawer links back to the full rule page, which asks the runtime for a handler.
setReturnToPreviousHook(() => () => {});

const ui = {
  drawer: byRole('dialog'),
};

describe('RuleDetailsDrawer', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingInstanceCreate]);
  });

  it('fills in the rule without ever replacing the drawer', async () => {
    // Hold the rule back so the loading state is on screen long enough to grab hold of.
    server.use(
      http.get('/api/ruler/grafana/api/v1/rule/:uid', async () => {
        await delay(100);
        return HttpResponse.json(grafanaRulerRule);
      })
    );

    render(<RuleDetailsDrawer ruleUID={grafanaRulerRule.grafana_alert.uid} onClose={() => {}} />);

    const drawerWhileLoading = await ui.drawer.find();

    // Found *within* the very same element, so the drawer was updated in place rather than being
    // torn down and animated in again - which is what reads as a flicker.
    await waitFor(() => {
      expect(within(drawerWhileLoading).getByRole('tab', { name: /Query and conditions/ })).toBeInTheDocument();
    });
    expect(ui.drawer.get()).toBe(drawerWhileLoading);
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
  });
});
