import { DropResult } from '@hello-pangea/dnd';

import { t } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';

import { Transformation } from '../types';

import { DraggableList } from './DraggableList';
import { QueryCard } from './QueryCard';
import { QuerySidebarCollapsableHeader } from './QuerySidebarCollapsableHeader';
import { TransformationCard } from './TransformationCard';

interface QueriesAndTransformationsViewProps {
  queries: DataQuery[];
  transformations: Transformation[];
  onQueryDragEnd: (result: DropResult) => void;
  onTransformationDragEnd: (result: DropResult) => void;
}

export function QueriesAndTransformationsView({
  queries,
  transformations,
  onQueryDragEnd,
  onTransformationDragEnd,
}: QueriesAndTransformationsViewProps) {
  return (
    <>
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
    </>
  );
}
