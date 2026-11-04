import { t } from '@grafana/i18n';
import { useScopes } from '@grafana/runtime';
import { ToolbarButton } from '@grafana/ui';

import { useScopesServices } from '../ScopesContextProvider';

interface Props {
  className?: string;
  hideWhenOpen?: boolean;
}

export function ContextualNavigationPaneToggle({ className, hideWhenOpen }: Props) {
  const scopes = useScopes();
  const services = useScopesServices();

  if (!scopes || !services) {
    return;
  }

  const { scopesDashboardsService } = services;
  const { drawerOpened } = scopes.state;

  if (hideWhenOpen && drawerOpened) {
    return null;
  }

  const dashboardsIconLabel = drawerOpened
    ? t('scopes.dashboards.toggle.collapse', 'Collapse suggested dashboards list')
    : t('scopes.dashboards.toggle.expand', 'Expand suggested dashboards list');

  return (
    <div className={className}>
      <ToolbarButton
        icon="web-section-alt"
        aria-label={dashboardsIconLabel}
        tooltip={dashboardsIconLabel}
        data-testid="scopes-dashboards-expand"
        onClick={scopesDashboardsService.toggleDrawer}
        variant={'canvas'}
      />
    </div>
  );
}
