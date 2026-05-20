import { css } from '@emotion/css';
import { memo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, ScrollContainer, useStyles2 } from '@grafana/ui';

import { SegmentedToggle, type SegmentedToggleProps } from '../../SegmentedToggle';
import { QueryEditorType, type SidebarSize } from '../../constants';
import { trackSidebarViewChange } from '../../tracking';
import { useAlertingContext, useQueryEditorUIContext } from '../QueryEditorContext';
import { EMPTY_ALERT } from '../types';

import { AlertsView } from './Alerts/AlertsView';
import { SidebarFooter } from './Footer/SidebarFooter';
import { QueriesAndTransformationsView } from './QueriesAndTransformationsView';
import { SidebarHeaderActions } from './SidebarHeaderActions';

interface SidebarProps {
  sidebarSize: SidebarSize;
  setSidebarSize: (size: SidebarSize) => void;
}

export const Sidebar = memo(function Sidebar({ sidebarSize, setSidebarSize }: SidebarProps) {
  const styles = useStyles2(getStyles);
  const { setSelectedAlert, cardType, pendingExpression, pendingTransformation, stackedMode } =
    useQueryEditorUIContext();
  const { alertRules, loading } = useAlertingContext();

  const handleViewChange = (view: QueryEditorType) => {
    trackSidebarViewChange(view);
    setSelectedAlert(view === QueryEditorType.Alert ? (alertRules[0] ?? EMPTY_ALERT) : null);
  };

  const toggleValue = cardType === QueryEditorType.Alert ? QueryEditorType.Alert : QueryEditorType.Query;

  const alertsLabel = loading
    ? t('query-editor-next.sidebar.alerts-loading', 'Alerts')
    : t('query-editor-next.sidebar.alerts', 'Alerts ({{count}})', { count: alertRules.length });

  const viewOptions: SegmentedToggleProps<QueryEditorType>['options'] = [
    { value: QueryEditorType.Query, label: t('query-editor-next.sidebar.data', 'Data'), icon: 'database' },
    { value: QueryEditorType.Alert, label: alertsLabel, icon: 'bell' },
  ];

  const showStackedModeAction = cardType !== QueryEditorType.Alert && !pendingExpression && !pendingTransformation;
  const stackedModeLabel = stackedMode.enabled
    ? t('query-editor-next.sidebar.exit-stacked-view', 'Exit stacked view')
    : t('query-editor-next.sidebar.enter-stacked-view', 'Enter stacked view');

  return (
    <div className={styles.container}>
      <SidebarHeaderActions sidebarSize={sidebarSize} setSidebarSize={setSidebarSize}>
        <SegmentedToggle
          options={viewOptions}
          value={toggleValue}
          onChange={handleViewChange}
          aria-label={t('query-editor-next.sidebar.view-toggle', 'View')}
          showBackground={false}
        />
        {showStackedModeAction && (
          <div className={styles.stackedModeAction}>
            <IconButton
              name="layer-group"
              size="sm"
              variant="secondary"
              className={stackedMode.enabled ? styles.stackedModeActionButtonActive : undefined}
              onClick={stackedMode.enabled ? stackedMode.exit : stackedMode.enter}
              aria-label={stackedModeLabel}
              aria-pressed={stackedMode.enabled}
            />
          </div>
        )}
      </SidebarHeaderActions>
      {/** The translateX property of the hoverActions in SidebarCard causes the scroll container to overflow by 8px. */}
      <ScrollContainer overflowX="hidden">
        <div className={styles.content}>
          {cardType === QueryEditorType.Alert ? (
            <AlertsView alertRules={alertRules} />
          ) : (
            <QueriesAndTransformationsView />
          )}
        </div>
      </ScrollContainer>
      <SidebarFooter />
    </div>
  );
});

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
    }),
    content: css({
      background: theme.colors.background.primary,
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    }),
    stackedModeAction: css({
      marginLeft: 'auto',
    }),
    stackedModeActionButtonActive: css({
      color: theme.colors.primary.text,
      '&::before, &:hover::before': {
        backgroundColor: theme.colors.primary.transparent,
        opacity: 1,
      },
    }),
  };
}
