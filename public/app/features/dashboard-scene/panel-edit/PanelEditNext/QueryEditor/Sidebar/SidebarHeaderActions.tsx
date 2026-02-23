import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, useStyles2 } from '@grafana/ui';

import { SegmentedToggle, SegmentedToggleProps } from '../../SegmentedToggle';
import { QUERY_EDITOR_COLORS, QueryEditorType, SidebarSize } from '../../constants';
import { useAlertingContext } from '../QueryEditorContext';

interface SidebarHeaderActionsProps {
  sidebarSize: SidebarSize;
  setSidebarSize: (size: SidebarSize) => void;
  activeView: QueryEditorType;
  onViewChange: (view: QueryEditorType) => void;
}

export function SidebarHeaderActions({
  sidebarSize,
  setSidebarSize,
  activeView,
  onViewChange,
}: SidebarHeaderActionsProps) {
  const styles = useStyles2(getStyles);
  const { alertRules, loading } = useAlertingContext();

  const isMini = sidebarSize === SidebarSize.Mini;

  const alertsLabel = loading
    ? t('query-editor-next.sidebar.alerts-loading', 'Alerts')
    : t('query-editor-next.sidebar.alerts', 'Alerts ({{count}})', { count: alertRules.length });

  const options: SegmentedToggleProps<QueryEditorType>['options'] = [
    { value: QueryEditorType.Query, label: t('query-editor-next.sidebar.data', 'Data'), icon: 'database' },
    { value: QueryEditorType.Alert, label: alertsLabel, icon: 'bell' },
  ];

  return (
    <div className={styles.header}>
      <div className={styles.inner}>
        <IconButton
          name={isMini ? 'maximize-left' : 'compress-alt-left'}
          size="sm"
          variant="secondary"
          onClick={() => setSidebarSize(isMini ? SidebarSize.Full : SidebarSize.Mini)}
          aria-label={t('query-editor-next.sidebar.toggle-size', 'Toggle sidebar size')}
        />
        <SegmentedToggle
          options={options}
          value={activeView}
          onChange={onViewChange}
          aria-label={t('query-editor-next.sidebar.view-toggle', 'View')}
          showBackground={false}
        />
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    header: css({
      background: QUERY_EDITOR_COLORS.card.headerBg,
      padding: theme.spacing(0.5, 1.5),
      minHeight: theme.spacing(5),
      display: 'flex',
      alignItems: 'center',
    }),
    inner: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
  };
}
