import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Button } from '@grafana/ui';

import { markViewPanelExit } from '../../../utils/viewPanelTracking';
import { type ToolbarActionProps } from '../types';

export const BackToDashboardButton = ({ dashboard }: ToolbarActionProps) => (
  <Button
    onClick={() => {
      if (dashboard.state.editview) {
        locationService.partial({ editview: null });
        return;
      }
      markViewPanelExit('toolbar_back');
      locationService.partial({ viewPanel: null, editPanel: null });
    }}
    tooltip=""
    fill={dashboard.state.editview ? 'text' : undefined}
    variant="secondary"
    size="sm"
    icon="arrow-left"
    data-testid={selectors.components.NavToolbar.editDashboard.backToDashboardButton}
  >
    <Trans i18nKey="dashboard.toolbar.new.back-to-dashboard">Back to dashboard</Trans>
  </Button>
);
