import { t } from '@grafana/i18n';
import { LoadingBar } from '@grafana/ui';

import { usePanelContext, useQueryRunnerContext } from '../QueryEditorContext';

import { AddCardButton } from './AddCardButton';
import { DraggableList } from './DraggableList';
import { QueryCard } from './QueryCard';
import { QuerySidebarCollapsableHeader } from './QuerySidebarCollapsableHeader';
import { TransformationCard } from './TransformationCard';
import { useSidebarDragAndDrop } from './useSidebarDragAndDrop';

export function QueriesAndTransformationsView() {
  const { queries, isLoading } = useQueryRunnerContext();
  const { transformations } = usePanelContext();
  const { onQueryDragEnd, onTransformationDragEnd } = useSidebarDragAndDrop();

  if (isLoading) {
    return (
      <LoadingBar
        width={400}
        ariaLabel={t(
          'query-editor-next.sidebar.loading-queries-transformations',
          'Loading queries and transformations'
        )}
      />
    );
  }

  return (
    <>
      <QuerySidebarCollapsableHeader
        label={t('query-editor-next.sidebar.queries-expressions', 'Queries & Expressions')}
        headerAction={<AddCardButton variant="query" alwaysVisible />}
      >
        <DraggableList
          droppableId="query-sidebar-queries"
          items={queries}
          keyExtractor={(query) => query.refId}
          renderItem={(query) => <QueryCard query={query} />}
          onDragEnd={onQueryDragEnd}
        />
      </QuerySidebarCollapsableHeader>
      <QuerySidebarCollapsableHeader
        label={t('query-editor-next.sidebar.transformations', 'Transformations')}
        headerAction={<AddCardButton variant="transformation" alwaysVisible />}
      >
        {transformations.length > 0 && (
          <DraggableList
            droppableId="query-sidebar-transformations"
            items={transformations}
            keyExtractor={(t) => t.transformId}
            renderItem={(t) => <TransformationCard transformation={t} />}
            onDragEnd={onTransformationDragEnd}
          />
        )}
      </QuerySidebarCollapsableHeader>
    </>
  );
}
