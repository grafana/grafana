import { type FormEvent } from 'react';

import { reportInteraction } from '@grafana/runtime';
import { ActionRow } from 'app/features/search/page/components/ActionRow';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { type SearchLayout } from 'app/features/search/types';

// Silent CUJ-only signal: which filter dimension changed, and whether the user
// cleared it. No filter values are sent (could be PII for tags / created-by /
// datasource UIDs). Picked up by the browse_to_resource journey wiring.
function reportFilterChanged(dimension: string, cleared: boolean) {
  reportInteraction('grafana_browse_dashboards_filter_changed', { dimension, cleared }, { silent: true });
}

export function BrowseFilters() {
  const [searchState, stateManager] = useSearchStateManager();

  const onLayoutChange = (layout: SearchLayout) => {
    reportFilterChanged('layout', false);
    stateManager.onLayoutChange(layout);
  };
  const onSortChange = (sort: string | undefined) => {
    reportFilterChanged('sort', !sort);
    stateManager.onSortChange(sort);
  };
  const onStarredFilterChange = (e: FormEvent<HTMLInputElement>) => {
    reportFilterChanged('starred', !e.currentTarget.checked);
    stateManager.onStarredFilterChange(e);
  };
  const onTagFilterChange = (tags: string[]) => {
    reportFilterChanged('tag', tags.length === 0);
    stateManager.onTagFilterChange(tags);
  };
  const onDatasourceChange = (datasource: string | undefined) => {
    reportFilterChanged('datasource', !datasource);
    stateManager.onDatasourceChange(datasource);
  };
  const onPanelTypeChange = (panelType?: string) => {
    reportFilterChanged('panel_type', !panelType);
    stateManager.onPanelTypeChange(panelType);
  };
  const onSetIncludePanels = (includePanels: boolean) => {
    reportFilterChanged('include_panels', !includePanels);
    stateManager.onSetIncludePanels(includePanels);
  };
  const onCreatedByChange = (createdBy: string | undefined) => {
    reportFilterChanged('created_by', !createdBy);
    stateManager.onCreatedByChange(createdBy);
  };
  const onOwnerReferenceChange = (ownerReference: string[]) => {
    reportFilterChanged('owner_reference', ownerReference.length === 0);
    stateManager.onOwnerReferenceChange(ownerReference);
  };

  return (
    <ActionRow
      showStarredFilter
      showLayout
      state={searchState}
      getTagOptions={stateManager.getTagOptions}
      getSortOptions={getGrafanaSearcher().getSortOptions}
      sortPlaceholder={getGrafanaSearcher().sortPlaceholder}
      onLayoutChange={onLayoutChange}
      onStarredFilterChange={onStarredFilterChange}
      onSortChange={onSortChange}
      onTagFilterChange={onTagFilterChange}
      onDatasourceChange={onDatasourceChange}
      onPanelTypeChange={onPanelTypeChange}
      onSetIncludePanels={onSetIncludePanels}
      onCreatedByChange={onCreatedByChange}
      onOwnerReferenceChange={onOwnerReferenceChange}
    />
  );
}
