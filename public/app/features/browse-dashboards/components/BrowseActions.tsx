import React, { useMemo } from 'react';

import { Input } from '@grafana/ui';
import { ActionRow } from 'app/features/search/page/components/ActionRow';
import { SearchLayout } from 'app/features/search/types';

export function BrowseActions() {
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
      <Input placeholder="Search box" />

      <br />

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
