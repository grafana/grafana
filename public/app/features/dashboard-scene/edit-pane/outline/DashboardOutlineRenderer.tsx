import { css } from '@emotion/css';
import { useState } from 'react';
import { useDebounce } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { type SceneComponentProps } from '@grafana/scenes';
import { Box, FilterInput, ScrollContainer, Sidebar, Text, useStyles2 } from '@grafana/ui';

import { getDashboardSceneFor } from '../../utils/utils';

import { type DashboardOutline } from './DashboardOutline';
import { computeSearchMatches, DashboardOutlineNode } from './DashboardOutlineNode';

export function DashboardOutlineRenderer({ model }: SceneComponentProps<DashboardOutline>) {
  const styles = useStyles2(getStyles);
  const dashboard = getDashboardSceneFor(model);
  const { searchQuery } = model.useState();
  const { isEditing } = dashboard.useState();
  const noTitleText = t('dashboard.outline.tree-item.no-title', '<no title>');

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  useDebounce(() => setDebouncedSearchQuery(searchQuery), 200, [searchQuery]);

  const trimmedSearchQuery = debouncedSearchQuery.trim();
  const isSearching = trimmedSearchQuery.length > 0;

  const searchMatches = isSearching
    ? computeSearchMatches(dashboard, trimmedSearchQuery, Boolean(isEditing), noTitleText)
    : null;
  const hasResults = !searchMatches || searchMatches.matchingKeys.size > 0;

  return (
    <Box display="flex" direction="column" flex={1} height="100%">
      <Sidebar.PaneHeader title={t('dashboard.outline.pane-header', 'Content outline')} />
      <div className={styles.container}>
        <FilterInput
          data-testid={selectors.pages.Dashboard.Sidebar.outline.searchInput}
          value={searchQuery}
          onChange={(query) => model.setSearchQuery(query)}
          escapeRegex={false}
          className={styles.input}
        />
      </div>
      <ScrollContainer showScrollIndicators={true}>
        <Box padding={1} gap={0} display="flex" direction="column" element="ul" role="tree" position="relative">
          {hasResults ? (
            <DashboardOutlineNode
              sceneObject={dashboard}
              isEditing={isEditing}
              editPane={dashboard.state.editPane}
              outline={model}
              depth={0}
              index={0}
              searchMatchKeys={searchMatches?.matchingKeys}
              searchVisibleKeys={searchMatches?.visibleKeys}
            />
          ) : (
            <li className={styles.noResults}>
              <Text color="secondary">
                <Trans i18nKey="dashboard.outline.search.no-results">No results found for your query</Trans>
              </Text>
            </li>
          )}
        </Box>
      </ScrollContainer>
    </Box>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      padding: theme.spacing(1, 1, 0, 1),
    }),
    input: css({
      width: '100%',
    }),
    noResults: css({
      display: 'flex',
      padding: theme.spacing(1),
    }),
  };
}
