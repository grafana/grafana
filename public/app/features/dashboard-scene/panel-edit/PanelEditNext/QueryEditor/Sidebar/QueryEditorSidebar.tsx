import { css } from '@emotion/css';
import { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Stack, Text, useStyles2 } from '@grafana/ui';

import { SidebarSize } from '../../constants';
import { usePanelContext, useQueryRunnerContext } from '../QueryEditorContext';

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
  const { onQueryDragStart, onQueryDragEnd, onTransformationDragEnd } = useSidebarDragAndDrop({
    queries,
    transformations,
  });

  const toggleSize = () => {
    setSidebarSize(isMini ? SidebarSize.Full : SidebarSize.Mini);
  };

  return (
    <div className={styles.container}>
      <Stack direction="row" alignItems="center" gap={1}>
        <IconButton
          name={isMini ? 'maximize-left' : 'compress-alt-left'}
          size="sm"
          variant="secondary"
          onClick={toggleSize}
          aria-label={t('query-editor-next.sidebar.toggle-size', 'Toggle sidebar size')}
        />
        <Text weight="medium" variant="h6">
          {t('query-editor-next.sidebar.query-stack', 'Query Stack')}
        </Text>
      </Stack>
      <QuerySidebarCollapsableHeader
        label={t('query-editor-next.sidebar.queries-expressions', 'Queries & Expressions')}
      >
        <DraggableList
          droppableId="query-sidebar-queries"
          items={queries}
          keyExtractor={(query) => query.refId}
          renderItem={(query) => <QueryCard query={query} />}
          onDragStart={onQueryDragStart}
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
  );
});

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      height: '100%',
      position: 'relative',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1),
      background: theme.colors.background.primary,
    }),
  };
}
