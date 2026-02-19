import { ChangeEvent, useEffect, useState } from 'react';

import { store, NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, Stack, Input, Icon, IconButton } from '@grafana/ui';
import { useSelector } from 'app/types/store';

import { getSectionExpanded } from './utils';

export const MegaMenuControls = ({
  onFilterChange,
  defaultExpandedState,
}: {
  onFilterChange: (filter: string) => void;
  defaultExpandedState: boolean;
}) => {
  const [isAnythingExpanded, setIsAnythingExpanded] = useState(defaultExpandedState);
  const [filterValue, setFilterValue] = useState('');
  const navTree = useSelector((state) => state.navBarTree);
  const toggleAllSections = (tree: NavModelItem[], expanded: boolean) => {
    setIsAnythingExpanded(expanded);
    tree.forEach((item) => {
      if (item.children) {
        toggleAllSections(item.children, expanded);
      }
      if (expanded) {
        store.set(`grafana.navigation.expanded[${item.id}]`, true);
      } else {
        store.delete(`grafana.navigation.expanded[${item.id}]`);
      }
    });
  };

  useEffect(() => {
    return store.subscribe('grafana.navigation.expanded-state-change', () => {
      setIsAnythingExpanded(navTree.some((item) => getSectionExpanded(item)));
    });
  });

  const expandAllSections = () => {
    toggleAllSections(navTree, true);
  };
  const collapseAllSections = () => {
    toggleAllSections(navTree, false);
  };

  const handleExpandCollapse = () => {
    if (isAnythingExpanded) {
      collapseAllSections();
    } else {
      expandAllSections();
    }
  };

  const handleFilterChange = (filter: string) => {
    setFilterValue(filter);
    expandAllSections();
    onFilterChange(filter);
  };

  const tooltip = isAnythingExpanded
    ? t('navigation.megamenu.collapse-all-sections', 'Collapse all sections')
    : t('navigation.megamenu.expand-all-sections', 'Expand all sections');
  const iconName = isAnythingExpanded ? 'angle-up' : 'angle-down';
  return (
    <Box padding={1} paddingLeft={1}>
      <Stack direction="row" gap={2}>
        <Input
          name="menu-filter"
          aria-label={t('navigation.megamenu.search-input-label', 'Search menu')}
          value={filterValue}
          prefix={<Icon name="search" />}
          placeholder={t('navigation.megamenu.search-placeholder', 'Search menu')}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            return handleFilterChange(e.target.value);
          }}
        />
        <Stack direction="row" gap={0.25}>
          {!filterValue && <IconButton name={iconName} tooltip={tooltip} onClick={handleExpandCollapse} />}
          {filterValue && (
            <IconButton
              name="times"
              tooltip={t('navigation.megamenu.clear-filter-tooltip', 'Clear filter')}
              onClick={() => handleFilterChange('')}
            />
          )}
        </Stack>
      </Stack>
    </Box>
  );
};
