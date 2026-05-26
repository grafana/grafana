import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { type SceneComponentProps } from '@grafana/scenes';
import { Box, FilterInput, ScrollContainer, Sidebar, Text, useStyles2 } from '@grafana/ui';

import { getDashboardSceneFor } from '../../utils/utils';

import { type DashboardOutline } from './DashboardOutline';
import { DashboardOutlineNode } from './DashboardOutlineNode';
import { DashboardOutlineSearchResultNode } from './DashboardOutlineSearchResultNode';
import { flattenOutlineNodes } from './utils';

export function DashboardOutlineRenderer({ model }: SceneComponentProps<DashboardOutline>) {
  const styles = useStyles2(getStyles);
  const dashboard = getDashboardSceneFor(model);
  const { isEditing } = dashboard.useState();
  const isEditingMode = Boolean(isEditing);
  const [searchQuery, setSearchQuery] = useState('');
  const noTitleText = t('dashboard.outline.tree-item.no-title', '<no title>');
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const isSearching = normalizedSearchQuery.length > 0;

  const flattenedNodes = flattenOutlineNodes(dashboard, isEditingMode, noTitleText);
  const searchResults = isSearching
    ? flattenedNodes.filter((node) => {
        if (node.depth <= 0) {
          return false;
        }

        const searchableText = `${node.instanceName} ${node.typeName} ${node.path.join(' ')}`.toLowerCase();
        return searchableText.includes(normalizedSearchQuery);
      })
    : [];

  return (
    <Box display="flex" direction="column" flex={1} height="100%">
      <Sidebar.PaneHeader title={t('dashboard.outline.pane-header', 'Content outline')} />
      <div className={styles.container}>
        <FilterInput
          value={searchQuery}
          onChange={setSearchQuery}
          escapeRegex={false}
          placeholder={t('dashboard.outline.search.placeholder', 'Search outline')}
          className={styles.input}
        />
      </div>
      <ScrollContainer showScrollIndicators={true}>
        <Box
          padding={1}
          gap={isSearching ? 0.5 : 0}
          display="flex"
          direction="column"
          element="ul"
          role="tree"
          position="relative"
        >
          {isSearching ? (
            searchResults.length > 0 ? (
              searchResults.map((node, index) => (
                <DashboardOutlineSearchResultNode
                  key={node.sceneObject.state.key ?? `${node.instanceName}-${index}`}
                  node={node}
                  resultIndex={index}
                  isEditing={isEditing}
                  editPane={dashboard.state.editPane}
                />
              ))
            ) : (
              <li className={styles.noResults}>
                <Text color="secondary">
                  <Trans i18nKey="dashboard.outline.search.no-results">No results found for your query</Trans>
                </Text>
              </li>
            )
          ) : (
            <DashboardOutlineNode
              sceneObject={dashboard}
              isEditing={isEditing}
              editPane={dashboard.state.editPane}
              outline={model}
              depth={0}
              index={0}
            />
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
