import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { Icon, useTheme, stylesFactory, Button } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { SearchSrv } from 'app/core/services/search_srv';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { contextSrv } from 'app/core/services/context_srv';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { useDashboardSearch } from '../hooks/useDashboardSearch';
import { SearchField } from './SearchField';
import { SearchResults } from './SearchResults';

const searchSrv = new SearchSrv();

const { isEditor, hasEditPermissionInFolders } = contextSrv;
const canEdit = isEditor || hasEditPermissionInFolders;

export interface Props {
  onCloseSearch: () => void;
  folder?: string;
}

export const DashboardSearch: FC<Props> = ({ onCloseSearch, folder }) => {
  const payload = folder ? { query: `folder:${folder}` } : {};
  const { query, onQueryChange, onClearFilters, onTagFilterChange, onTagAdd } = useSearchQuery(payload);
  const { results, loading, onToggleSection, onKeyDown } = useDashboardSearch(query, onCloseSearch);
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
      <div className="search-dropdown">
        <div className={cx('search-dropdown__col_1', styles.resultsWrapper)}>
          <SearchResults
            results={results}
            loading={loading}
            onTagSelected={onTagAdd}
            editable={false}
            onToggleSection={onToggleSection}
          />
        </div>
        <div className="search-dropdown__col_2">
          <div className="search-filter-box">
            <div className="search-filter-box__header">
              <Icon name="filter" className={styles.filter} size="sm" />
              Filter by:
              {query.tag.length > 0 && (
                <a className="pointer pull-right small" onClick={onClearFilters}>
                  <Icon name="times" size="sm" /> Clear
                </a>
              )}
            </div>

            <TagFilter tags={query.tag} tagOptions={searchSrv.getDashboardTags} onChange={onTagFilterChange} />
          </div>

          {canEdit && (
            <div className="search-filter-box" onClick={onCloseSearch}>
              <a href="dashboard/new" className="search-filter-box-link">
                <Icon name="apps" size="xl" className={styles.icon} /> New dashboard
              </a>
              {isEditor && (
                <a href="dashboards/folder/new" className="search-filter-box-link">
                  <Icon name="folder-plus" size="xl" className={styles.icon} /> New folder
                </a>
              )}
              <a href="dashboard/import" className="search-filter-box-link">
                <Icon name="import" size="xl" className={styles.icon} /> Import dashboard
              </a>
              <a
                className="search-filter-box-link"
                target="_blank"
                href="https://grafana.com/dashboards?utm_source=grafana_search"
              >
                <Icon name="search" size="xl" className={styles.icon} /> Find dashboards on Grafana.com
              </a>
            </div>
          )}
        </div>
        <Button icon="times" className={styles.closeBtn} onClick={onCloseSearch} variant="secondary">
          Close
        </Button>
      </div>
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
    resultsWrapper: css`
      padding: 0;
      overflow-y: auto;
    `,
  };
});
