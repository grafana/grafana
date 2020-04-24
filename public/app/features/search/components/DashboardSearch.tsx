import React, { FC, memo } from 'react';
import { css } from 'emotion';
import { useTheme, CustomScrollbar, stylesFactory, Button } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { useDashboardSearch } from '../hooks/useDashboardSearch';
import { useSearchLayout } from '../hooks/useSearchLayout';
import { SearchField } from './SearchField';
import { SearchResults } from './SearchResults';
import { ActionRow } from './ActionRow';

export interface Props {
  onCloseSearch: () => void;
  folder?: string;
}

export const DashboardSearch: FC<Props> = memo(({ onCloseSearch, folder }) => {
  const payload = folder ? { query: `folder:${folder}` } : {};
  const { query, onQueryChange, onTagFilterChange, onTagAdd, onSortChange } = useSearchQuery(payload);
  const { results, loading, onToggleSection, onKeyDown } = useDashboardSearch(query, onCloseSearch);
  const { layout, setLayout } = useSearchLayout(query);
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
        <ActionRow
          {...{
            layout,
            onLayoutChange,
            onSortChange,
            onTagFilterChange,
            query,
          }}
        />
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
});

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    closeBtn: css`
      top: 10px;
      right: 8px;
      position: absolute;
    `,
    searchField: css`
      padding-left: ${theme.spacing.md};
    `,
    search: css`
      display: flex;
      flex-direction: column;
      padding: ${theme.spacing.xl};
      height: 100%;
      max-width: 1400px;
    `,
  };
});
