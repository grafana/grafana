import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { FilterInput, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { t } from 'app/core/internationalization';
import { ActionRow } from 'app/features/search/page/components/ActionRow';
import { getGrafanaSearcher } from 'app/features/search/service';

import { useTrashStateManager } from './useTrashStateManager';

const TrashPage = () => {
  const [searchState, stateManager] = useTrashStateManager();

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
      </Page.Contents>
    </Page>
  );
};

export default TrashPage;
