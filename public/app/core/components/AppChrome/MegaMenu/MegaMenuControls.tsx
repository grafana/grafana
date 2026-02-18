import { ChangeEvent, useState } from 'react';

import { store, NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, Stack, Input, Icon, IconButton } from '@grafana/ui';
import { useSelector } from 'app/types/store';

export const MegaMenuControls = ({ onFilterChange }: { onFilterChange: (filter: string) => void }) => {
  const [isAnythingExpanded, setIsAnythingExpanded] = useState(false);
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

  store.subscribe('grafana.navigation.expanded-state-change', () => {
    setIsAnythingExpanded(navTree.some((item) => Boolean(store.get(`grafana.navigation.expanded[${item.id}]`))));
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
    <Box padding={1} paddingLeft={2}>
      <Stack direction="row" gap={1}>
        <Input
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
