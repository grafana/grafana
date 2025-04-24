import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { Button } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { ToolbarActionProps } from '../types';

export const BackToDashboardButton = ({ dashboard }: ToolbarActionProps) => (
  <Button
    onClick={() =>
      locationService.partial(dashboard.state.editview ? { editview: null } : { viewPanel: null, editPanel: null })
    }
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
