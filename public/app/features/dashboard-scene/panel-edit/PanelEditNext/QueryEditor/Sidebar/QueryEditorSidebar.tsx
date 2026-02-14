import { css } from '@emotion/css';
import { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, ScrollContainer, Stack, Text, useStyles2 } from '@grafana/ui';

import { QUERY_EDITOR_COLORS, SidebarSize } from '../../constants';
import { usePanelContext, useQueryRunnerContext } from '../QueryEditorContext';

import { AlertIndicator } from './AlertIndicator';
import { DraggableList } from './DraggableList';
import { QueryCard } from './QueryCard';
import { QuerySidebarCollapsableHeader } from './QuerySidebarCollapsableHeader';
import { TransformationCard } from './TransformationCard';
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
  const { onQueryDragEnd, onTransformationDragEnd } = useSidebarDragAndDrop();

  const toggleSize = () => {
    setSidebarSize(isMini ? SidebarSize.Full : SidebarSize.Mini);
  };

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
              {t('query-editor-next.sidebar.data', 'Data')}
            </Text>
          </Stack>
          <AlertIndicator />
        </Stack>
      </div>
      {/** The translateX property of the hoverActions in SidebarCard causes the scroll container to overflow by 8px. */}
      <ScrollContainer overflowX="hidden">
        <div className={styles.content}>
          <QuerySidebarCollapsableHeader
            label={t('query-editor-next.sidebar.queries-expressions', 'Queries & Expressions')}
          >
            <DraggableList
              droppableId="query-sidebar-queries"
              items={queries}
              keyExtractor={(query) => query.refId}
              renderItem={(query) => <QueryCard query={query} />}
              onDragEnd={onQueryDragEnd}
            />
          </QuerySidebarCollapsableHeader>
          {transformations.length > 0 && (
            <QuerySidebarCollapsableHeader label={t('query-editor-next.sidebar.transformations', 'Transformations')}>
              <DraggableList
                droppableId="query-sidebar-transformations"
                items={transformations}
                keyExtractor={(t) => t.transformId}
                renderItem={(t) => <TransformationCard transformation={t} />}
                onDragEnd={onTransformationDragEnd}
              />
            </QuerySidebarCollapsableHeader>
          )}
        </div>
      </ScrollContainer>
      <div className={styles.footer}>
        <Text weight="medium" variant="bodySmall">
          {t('query-editor-next.sidebar.data-mode', 'Data Mode')}
        </Text>
      </div>
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
    footer: css({
      marginTop: 'auto',
      background: QUERY_EDITOR_COLORS.card.headerBg,
      padding: theme.spacing(1, 1.5),
    }),
  };
}
