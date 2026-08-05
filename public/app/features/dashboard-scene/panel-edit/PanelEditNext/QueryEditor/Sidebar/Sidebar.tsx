import { css } from '@emotion/css';
import { memo, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useFlagPaneleditButtonLabels } from '@grafana/runtime/internal';
import { Button, IconButton, ScrollContainer, useStyles2 } from '@grafana/ui';

import { SegmentedToggle, type SegmentedToggleProps } from '../../SegmentedToggle';
import { QueryEditorType, type SidebarSize } from '../../constants';
import { trackSidebarViewChange, trackStackedViewToggle } from '../../tracking';
import { useAlertingContext, useQueryEditorUIContext } from '../QueryEditorContext';
import { getSelectedStackedItem } from '../StackedEditor/utils';
import { EMPTY_ALERT } from '../types';

import { AlertsView } from './Alerts/AlertsView';
import { SidebarFooter } from './Footer/SidebarFooter';
import { QueriesAndTransformationsView } from './QueriesAndTransformationsView';
import { SidebarHeaderActions } from './SidebarHeaderActions';
import { useScrollSelectedCardIntoView } from './useScrollSelectedCardIntoView';

interface SidebarProps {
  sidebarSize: SidebarSize;
  setSidebarSize: (size: SidebarSize) => void;
}

export const Sidebar = memo(function Sidebar({ sidebarSize, setSidebarSize }: SidebarProps) {
  const showButtonLabels = useFlagPaneleditButtonLabels();
  const {
    setSelectedAlert,
    cardType,
    pendingExpression,
    pendingTransformation,
    stackedMode,
    selectedQuery,
    selectedTransformation,
  } = useQueryEditorUIContext();
  const { alertRules, loading } = useAlertingContext();
  const styles = useStyles2(getStyles);

  const contentRef = useRef<HTMLDivElement>(null);

  const selectedCardId = getSelectedStackedItem(selectedQuery, selectedTransformation)?.id ?? null;
  useScrollSelectedCardIntoView(contentRef, selectedCardId);

  const handleViewChange = (view: QueryEditorType) => {
    trackSidebarViewChange(view);
    setSelectedAlert(view === QueryEditorType.Alert ? (alertRules[0] ?? EMPTY_ALERT) : null);
  };

  const handleStackedModeToggle = () => {
    if (stackedMode.enabled) {
      trackStackedViewToggle('exit');
      stackedMode.exit();
    } else {
      trackStackedViewToggle('enter');
      stackedMode.enter();
    }
  };

  const toggleValue = cardType === QueryEditorType.Alert ? QueryEditorType.Alert : QueryEditorType.Query;

  const alertsLabel = loading
    ? t('query-editor-next.sidebar.alerts-loading', 'Alerts')
    : t('query-editor-next.sidebar.alerts', '', {
        count: alertRules.length,
        defaultValue_one: 'Alerts ({{count}})',
        defaultValue_other: 'Alerts ({{count}})',
      });

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
      <SidebarHeaderActions
        sidebarSize={sidebarSize}
        setSidebarSize={setSidebarSize}
        // The alerts label is the only width-affecting content that changes at runtime.
        contentKey={alertsLabel}
        trailing={
          showStackedModeAction ? (
            showButtonLabels ? (
              <Button
                icon="layer-group"
                size="sm"
                fill="text"
                variant="secondary"
                className={styles.stackedModeButton}
                data-active={stackedMode.enabled}
                onClick={handleStackedModeToggle}
                aria-pressed={stackedMode.enabled}
                tooltip={stackedModeLabel}
              >
                {t('query-editor-next.sidebar.stacked', 'Stack')}
              </Button>
            ) : (
              <span className={styles.stackedModeIconButton} data-active={stackedMode.enabled}>
                <IconButton
                  name="layer-group"
                  size="sm"
                  variant="secondary"
                  onClick={handleStackedModeToggle}
                  aria-pressed={stackedMode.enabled}
                  tooltip={stackedModeLabel}
                />
              </span>
            )
          ) : undefined
        }
      >
        {(compact) => (
          <SegmentedToggle
            options={viewOptions}
            value={toggleValue}
            onChange={handleViewChange}
            aria-label={t('query-editor-next.sidebar.view-toggle', 'View')}
            showBackground={false}
            hideLabels={compact}
          />
        )}
      </SidebarHeaderActions>
      {/** The translateX property of the hoverActions in SidebarCard causes the scroll container to overflow by 8px. */}
      <ScrollContainer overflowX="hidden">
        <div className={styles.content} ref={contentRef}>
          {cardType === QueryEditorType.Alert ? (
            <AlertsView alertRules={alertRules} />
          ) : (
            <QueriesAndTransformationsView showButtonLabels={showButtonLabels} />
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
    stackedModeButton: css({
      '&[data-active="true"]': {
        color: theme.colors.primary.text,
        backgroundColor: theme.colors.primary.transparent,
      },
    }),
    stackedModeIconButton: css({
      display: 'inline-flex',
      '&[data-active="true"] button': {
        color: theme.colors.primary.text,
        '&::before, &:hover::before': {
          backgroundColor: theme.colors.primary.transparent,
          opacity: 1,
        },
      },
    }),
  };
}
