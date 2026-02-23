import { css } from '@emotion/css';
import { memo, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ScrollContainer, useStyles2 } from '@grafana/ui';

import { QueryEditorType, SidebarSize } from '../../constants';
import {
  useAlertingContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from '../QueryEditorContext';
import { EMPTY_ALERT } from '../types';

import { AlertsView } from './AlertsView';
import { QueriesAndTransformationsView } from './QueriesAndTransformationsView';
import { SidebarFooter } from './SidebarFooter';
import { SidebarHeaderActions } from './SidebarHeaderActions';
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
  const { queries } = useQueryRunnerContext();
  const { transformations } = usePanelContext();
  const { alertRules } = useAlertingContext();
  const { cardType, setSelectedAlert } = useQueryEditorUIContext();
  const { onQueryDragEnd, onTransformationDragEnd } = useSidebarDragAndDrop();

  // Made to handle eventual new views (ai mode, etc.)
  // viewInitializers is a map of view types to functions that initialize the view
  const handleViewChange = useCallback(
    (view: QueryEditorType) => {
      const viewInitializers: Partial<Record<QueryEditorType, () => void>> = {
        [QueryEditorType.Alert]: () => setSelectedAlert(alertRules[0] ?? EMPTY_ALERT),
      };

      setSelectedAlert(null);
      viewInitializers[view]?.();
    },
    [alertRules, setSelectedAlert]
  );

  return (
    <div className={styles.container}>
      <SidebarHeaderActions
        activeView={cardType}
        onViewChange={handleViewChange}
        setSidebarSize={setSidebarSize}
        sidebarSize={sidebarSize}
      />
      {/** The translateX property of the hoverActions in SidebarCard causes the scroll container to overflow by 8px. */}
      <ScrollContainer overflowX="hidden">
        <div className={styles.content}>
          {cardType === QueryEditorType.Alert ? (
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
