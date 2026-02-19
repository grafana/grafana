import { css } from '@emotion/css';
import { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, ScrollContainer, Stack, Text, useStyles2 } from '@grafana/ui';

import { QUERY_EDITOR_COLORS, QueryEditorType, SidebarSize } from '../../constants';
import {
  useAlertingContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from '../QueryEditorContext';

import { AlertIndicator } from './AlertIndicator';
import { AlertsView } from './AlertsView';
import { QueriesAndTransformationsView } from './QueriesAndTransformationsView';
import { SidebarFooter } from './SidebarFooter';
import { useSidebarDragAndDrop } from './useSidebarDragAndDrop';

interface QueryEditorSidebarProps {
  sidebarSize: SidebarSize;
  setSidebarSize: (size: SidebarSize) => void;
}

export const QueryEditorSidebar = memo(function QueryEditorSidebar({
  sidebarSize,
  setSidebarSize,
}: QueryEditorSidebarProps) {
  const styles = useStyles2(getStyles);
  const isMini = sidebarSize === SidebarSize.Mini;
  const { queries } = useQueryRunnerContext();
  const { transformations } = usePanelContext();
  const { alertRules } = useAlertingContext();
  const { cardType } = useQueryEditorUIContext();
  const { onQueryDragEnd, onTransformationDragEnd } = useSidebarDragAndDrop();

  const toggleSize = () => {
    setSidebarSize(isMini ? SidebarSize.Full : SidebarSize.Mini);
  };

  const isAlertView = cardType === QueryEditorType.Alert;
  const sidebarHeaderTitle = isAlertView
    ? t('query-editor-next.sidebar.alerts', 'Alerts ({{count}})', { count: alertRules.length })
    : t('query-editor-next.sidebar.data', 'Data');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Stack direction="row" alignItems="center" gap={1} justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <IconButton
              name={isMini ? 'maximize-left' : 'compress-alt-left'}
              size="sm"
              variant="secondary"
              onClick={toggleSize}
              aria-label={t('query-editor-next.sidebar.toggle-size', 'Toggle sidebar size')}
            />
            <Text weight="medium" variant="h6">
              {sidebarHeaderTitle}
            </Text>
          </Stack>
          <AlertIndicator />
        </Stack>
      </div>
      {/** The translateX property of the hoverActions in SidebarCard causes the scroll container to overflow by 8px. */}
      <ScrollContainer overflowX="hidden">
        <div className={styles.content}>
          {isAlertView ? (
            <AlertsView alertRules={alertRules} />
          ) : (
            <QueriesAndTransformationsView
              queries={queries}
              transformations={transformations}
              onQueryDragEnd={onQueryDragEnd}
              onTransformationDragEnd={onTransformationDragEnd}
            />
          )}
        </div>
      </ScrollContainer>
      <SidebarFooter />
    </div>
  );
});

function getStyles(theme: GrafanaTheme2) {
  return {
    header: css({
      background: QUERY_EDITOR_COLORS.card.headerBg,
      padding: theme.spacing(1, 1.5),
    }),
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
    }),
  };
}
