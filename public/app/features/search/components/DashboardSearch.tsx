import React, { FC } from 'react';
import { css } from 'emotion';
import { useTheme, CustomScrollbar, stylesFactory, Button, RadioButtonGroup, HorizontalGroup } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { SearchSrv } from 'app/core/services/search_srv';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { SortPicker } from 'app/core/components/Select/SortPicker';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { useDashboardSearch } from '../hooks/useDashboardSearch';
import { useSearchLayout } from '../hooks/useSearchLayout';
import { SearchField } from './SearchField';
import { SearchResults } from './SearchResults';

const searchSrv = new SearchSrv();

export interface Props {
  onCloseSearch: () => void;
  folder?: string;
}

export const DashboardSearch: FC<Props> = ({ onCloseSearch, folder }) => {
  const payload = folder ? { query: `folder:${folder}` } : {};
  const { query, onQueryChange, onTagFilterChange, onTagAdd, onSortChange } = useSearchQuery(payload);
  const { results, loading, onToggleSection, onKeyDown } = useDashboardSearch(query, onCloseSearch);
  const { layout, setLayout, layoutOptions } = useSearchLayout(query);
  const theme = useTheme();
  const styles = getStyles(theme);

  // The main search input has own keydown handler, also TagFilter uses input, so
  // clicking Esc when tagFilter is active shouldn't close the whole search overlay
  const onClose = (e: React.KeyboardEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if ((target.tagName as any) !== 'INPUT' && ['Escape', 'ArrowLeft'].includes(e.key)) {
      onCloseSearch();
    }
  };

  const onLayoutChange = (layout: string) => {
    setLayout(layout);
    if (query.sort) {
      onSortChange(null);
    }
  };

  return (
    <div tabIndex={0} className="search-container" onKeyDown={onClose}>
      <SearchField
        query={query}
        onChange={onQueryChange}
        onKeyDown={onKeyDown}
        autoFocus
        clearable
        className={styles.searchField}
      />
      <div className={styles.search}>
        <div className={styles.actionRow}>
          <HorizontalGroup spacing="md">
            <RadioButtonGroup options={layoutOptions} onChange={onLayoutChange} value={layout} />
            <SortPicker onChange={onSortChange} value={query.sort} />
          </HorizontalGroup>
          <div className={styles.tagContainer}>
            <TagFilter tags={query.tag} tagOptions={searchSrv.getDashboardTags} onChange={onTagFilterChange} />
          </div>
        </div>
        <CustomScrollbar>
          <SearchResults
            results={results}
            loading={loading}
            onTagSelected={onTagAdd}
            editable={false}
            onToggleSection={onToggleSection}
            layout={layout}
          />
        </CustomScrollbar>
      </div>
      <Button icon="times" className={styles.closeBtn} onClick={onCloseSearch} variant="secondary">
        Close
      </Button>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    closeBtn: css`
      top: 10px;
      right: 8px;
      position: absolute;
    `,
    icon: css`
      margin-right: ${theme.spacing.sm};
      color: ${theme.palette.blue95};
    `,
    filter: css`
      margin-right: ${theme.spacing.xs};
    `,
    close: css`
      margin-left: ${theme.spacing.xs};
      margin-bottom: 1px;
    `,
    searchField: css`
      padding-left: ${theme.spacing.md};
    `,
    actionRow: css`
      display: flex;
      justify-content: space-between;
      padding: ${theme.spacing.md} 0;
    `,
    search: css`
      display: flex;
      flex-direction: column;
      padding: ${theme.spacing.xl};
      height: 100%;
    `,
    tagContainer: css`
      min-width: 200px;
      margin-left: ${theme.spacing.md};
    `,
  };
});
