import { t } from '@grafana/i18n';
import { Stack } from '@grafana/ui';

import { AlertRule } from '../types';

import { AlertCard } from './AlertCard';
import { QuerySidebarCollapsableHeader } from './QuerySidebarCollapsableHeader';

interface AlertsViewProps {
  alertRules: AlertRule[];
}

export function AlertsView({ alertRules }: AlertsViewProps) {
  if (alertRules.length === 0) {
    return null;
  }

  return (
    <QuerySidebarCollapsableHeader label={t('query-editor-next.sidebar.alerts', 'Alerts')}>
      <Stack direction="column" gap={1}>
        {alertRules.map((alert) => (
          <AlertCard key={alert.alertId} alert={alert} />
        ))}
      </Stack>
    </QuerySidebarCollapsableHeader>
  );
}
