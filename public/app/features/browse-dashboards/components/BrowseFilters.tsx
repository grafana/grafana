import React, { useMemo } from 'react';

import { ActionRow } from 'app/features/search/page/components/ActionRow';
import { SearchLayout } from 'app/features/search/types';

export function BrowseFilters() {
  const fakeState = useMemo(() => {
    return {
      query: '',
      tag: [],
      starred: false,
      layout: SearchLayout.Folders,
      eventTrackingNamespace: 'manage_dashboards' as const,
    };
  }, []);

  return (
    <div>
      <ActionRow
        includePanels={false}
        state={fakeState}
        getTagOptions={() => Promise.resolve([])}
        getSortOptions={() => Promise.resolve([])}
        onLayoutChange={() => {}}
        onSortChange={() => {}}
        onStarredFilterChange={() => {}}
        onTagFilterChange={() => {}}
        onDatasourceChange={() => {}}
        onPanelTypeChange={() => {}}
        onSetIncludePanels={() => {}}
      />
    </div>
  );
}
