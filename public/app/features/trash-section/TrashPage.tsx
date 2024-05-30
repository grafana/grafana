import React, { memo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { FilterInput } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { t } from 'app/core/internationalization';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { ActionRow } from 'app/features/search/page/components/ActionRow';
import { getGrafanaSearcher } from 'app/features/search/service';

import { BrowseView } from '../browse-dashboards/components/BrowseView';
import { SearchView } from '../browse-dashboards/components/SearchView';
import { getFolderPermissions } from '../browse-dashboards/permissions';

import { useTrashStateManager } from './useTrashStateManager';
// import {useDispatch} from "../../types";

export interface Props extends GrafanaRouteComponentProps {}

const TrashPage = memo(({ match }: Props) => {
  const { uid: folderUID } = match.params;
  // const dispatch = useDispatch(); TODO: will be used in useEffect()

  const [searchState, stateManager] = useTrashStateManager();
  const isSearching = stateManager.hasSearchFilters();

  const { canEditFolders, canEditDashboards } = getFolderPermissions(); // TODO: as the dashboards are separated from their folders does this still work?
  const canSelect = canEditFolders || canEditDashboards;

  return (
    <Page navId="dashboards/trash">
      <Page.Contents>
        <FilterInput
          placeholder={t('trashSection.filter.placeholder', 'Search for dashboards')}
          value={searchState.query}
          escapeRegex={false}
          onChange={(e) => stateManager.onQueryChange(e)}
        />
        <ActionRow
          showStarredFilter={false}
          state={searchState}
          getTagOptions={stateManager.getTagOptions}
          getSortOptions={getGrafanaSearcher().getSortOptions}
          sortPlaceholder={getGrafanaSearcher().sortPlaceholder}
          includePanels={false}
          onLayoutChange={stateManager.onLayoutChange}
          onSortChange={stateManager.onSortChange}
          onTagFilterChange={stateManager.onTagFilterChange}
          onDatasourceChange={stateManager.onDatasourceChange}
          onPanelTypeChange={stateManager.onPanelTypeChange}
          onSetIncludePanels={stateManager.onSetIncludePanels}
        />
        <AutoSizer>
          {({ width, height }) =>
            isSearching ? (
              <SearchView
                canSelect={canSelect}
                width={width}
                height={height}
                searchStateManager={stateManager}
                searchState={searchState}
              />
            ) : (
              <BrowseView canSelect={canSelect} width={width} height={height} folderUID={folderUID} />
            )
          }
        </AutoSizer>
      </Page.Contents>
    </Page>
  );
});

export default TrashPage;
