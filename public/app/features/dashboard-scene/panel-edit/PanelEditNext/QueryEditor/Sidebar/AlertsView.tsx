import { t } from '@grafana/i18n';
import { Icon, Stack, useStyles2 } from '@grafana/ui';

import { getAlertStateColor, QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../../constants';
import { AlertRule } from '../types';

import { AlertCard } from './AlertCard';
import { QuerySidebarCollapsableHeader } from './QuerySidebarCollapsableHeader';
import { SidebarCard } from './SidebarCard';

interface AlertsViewProps {
  alertRules: AlertRule[];
}

export function AlertsView({ alertRules }: AlertsViewProps) {
  const theme = useStyles2((theme) => theme);

  if (alertRules.length === 0) {
    const ghostItem = {
      name: 'New alert rule',
      type: QueryEditorType.Alert,
      isHidden: false,
      alertState: null,
    };

    return (
      <QuerySidebarCollapsableHeader label={t('query-editor-next.sidebar.alerts', 'Alerts')}>
        <Stack direction="column" gap={1}>
          <SidebarCard
            isSelected={false}
            id="ghost-alert"
            item={ghostItem}
            onClick={() => {}}
            showAddButton={false}
            variant="ghost"
          >
            <Icon
              name={QUERY_EDITOR_TYPE_CONFIG[QueryEditorType.Alert].icon}
              color={getAlertStateColor(theme, null)}
              size="sm"
            />
          </SidebarCard>
        </Stack>
      </QuerySidebarCollapsableHeader>
    );
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
