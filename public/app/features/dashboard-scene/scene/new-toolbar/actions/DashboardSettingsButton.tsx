import { selectors } from '@grafana/e2e-selectors';
import { Icon, ToolbarButton } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ToolbarActionProps } from '../types';

export const DashboardSettingsButton = ({ dashboard }: ToolbarActionProps) => (
  <ToolbarButton
    tooltip={t('dashboard.toolbar.new.dashboard-settings.tooltip', 'Dashboard settings')}
    icon={<Icon name="cog" size="lg" type="default" />}
    onClick={() => dashboard.onOpenSettings()}
    data-testid={selectors.components.NavToolbar.editDashboard.settingsButton}
  />
);
