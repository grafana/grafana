import { Trans, t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';

import { type ToolbarActionProps } from '../types';

/**
 * PulseButton opens the dashboard-scoped Pulse drawer. Visibility is
 * controlled at the RightActions list level — this component assumes
 * the dashboardPulse feature toggle is on whenever it renders.
 */
export const PulseButton = ({ dashboard }: ToolbarActionProps) => {
  return (
    <ToolbarButton
      icon="comment-alt"
      tooltip={t('dashboard.toolbar.new.pulse.tooltip', 'Open Pulse — start or join the conversation about this dashboard')}
      onClick={() => dashboard.onShowPulseDrawer()}
      data-testid="pulse-toolbar-button"
    >
      <Trans i18nKey="dashboard.toolbar.new.pulse.label">Pulse</Trans>
    </ToolbarButton>
  );
};
