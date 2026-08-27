import { render, screen } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setReturnToPreviousHook } from '@grafana/runtime';
import { type SceneQueryRunner } from '@grafana/scenes';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { grafanaRulerRule } from '../../mocks/grafanaRulerApi';
import { WorkbenchProvider } from '../WorkbenchContext';
import { type AlertRuleRow as AlertRuleRowType } from '../types';

import { AlertRuleRow } from './AlertRuleRow';

// Both of these render scene charts, which need a scene context that has nothing to do with the
// row's own behaviour.
jest.mock('../scene/AlertRuleSummary', () => ({ AlertRuleSummary: () => null }));
jest.mock('../scene/AlertRuleInstances', () => ({ AlertRuleInstances: () => null }));

setupMswServer();

// The details drawer links back to the full rule page, which asks the runtime for a "return to
// previous" handler.
setReturnToPreviousHook(() => () => {});

const ui = {
  ruleName: byRole('button', { name: /Open details for Grafana-rule/ }),
  detailsDrawer: byRole('dialog'),
  moreButton: byRole('button', { name: /More actions for Grafana-rule/ }),
};

const row: AlertRuleRowType = {
  type: 'alertRule',
  metadata: {
    title: grafanaRulerRule.grafana_alert.title,
    folder: 'test-folder-1',
    ruleUID: grafanaRulerRule.grafana_alert.uid,
  },
  instanceCounts: { firing: 2, pending: 1 },
};

function renderRow() {
  return render(
    <WorkbenchProvider
      leftColumnWidth={400}
      rightColumnWidth={400}
      domain={[new Date(0), new Date(60_000)]}
      queryRunner={{} as SceneQueryRunner}
      expandGeneration={0}
      collapseGeneration={0}
    >
      <AlertRuleRow row={row} leftColumnWidth={400} rowKey="rule-1" />
    </WorkbenchProvider>
  );
}

describe('AlertRuleRow', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingInstanceCreate]);
  });

  it('opens the rule details sidebar when the rule name is clicked', async () => {
    const { user } = renderRow();

    expect(ui.detailsDrawer.query()).not.toBeInTheDocument();

    await user.click(await ui.ruleName.find());

    // The sidebar swaps its loading state for the real rule once it arrives, so wait for the
    // loaded content rather than holding on to the first dialog we see.
    expect(await screen.findByRole('tab', { name: /Query and conditions/ })).toBeInTheDocument();
    expect(ui.detailsDrawer.get()).toBeInTheDocument();
  });

  it('shows the rule actions instead of a details button, and the instance counts alongside them', async () => {
    renderRow();

    expect(await ui.moreButton.find()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rule details/ })).not.toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
