import React, { FC, memo } from 'react';
import { css } from 'emotion';
import { useTheme, CustomScrollbar, stylesFactory, IconButton } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { useDashboardSearch } from '../hooks/useDashboardSearch';
import { SearchField } from './SearchField';
import { SearchResults } from './SearchResults';
import { ActionRow } from './ActionRow';

export interface Props {
  onCloseSearch: () => void;
  folder?: string;
}

export const DashboardSearch: FC<Props> = memo(({ onCloseSearch, folder }) => {
  const payload = folder ? { query: `folder:${folder} ` } : {};
  const { query, onQueryChange, onTagFilterChange, onTagAdd, onSortChange, onLayoutChange } = useSearchQuery(payload);
  const { results, loading, onToggleSection, onKeyDown } = useDashboardSearch(query, onCloseSearch);
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div tabIndex={0} className={styles.overlay}>
      <div className={styles.container}>
        <div className={styles.searchField}>
          <SearchField query={query} onChange={onQueryChange} onKeyDown={onKeyDown} autoFocus clearable />
          <div className={styles.closeBtn}>
            <IconButton name="times" surface="panel" onClick={onCloseSearch} size="xxl" tooltip="Close search" />
          </div>
        </div>
        <div className={styles.search}>
          <ActionRow
            {...{
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
              layout={query.layout}
            />
          </CustomScrollbar>
        </div>
      </div>
    </div>
  );
});

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    overlay: css`
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: ${theme.zIndex.sidemenu};
      position: fixed;
      background: ${theme.colors.dashboardBg};

      @media only screen and (min-width: ${theme.breakpoints.md}) {
        left: 60px;
        z-index: ${theme.zIndex.navbarFixed + 1};
      }
    `,
    container: css`
      max-width: 1400px;
      margin: 0 auto;
      padding: ${theme.spacing.md};

      height: 100%;

      @media only screen and (min-width: ${theme.breakpoints.md}) {
        padding: 32px;
      }
    `,
    closeBtn: css`
      right: -5px;
      top: 2px;
      z-index: 1;
      position: absolute;
    `,
    searchField: css`
      position: relative;
    `,
    search: css`
      display: flex;
      flex-direction: column;
      height: 100%;
    `,
  };
});
