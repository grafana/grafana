import React, { FC, memo } from 'react';
import { useLocalStorage } from 'react-use';
import { css } from '@emotion/css';
import { useTheme2, CustomScrollbar, stylesFactory, IconButton } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { useDashboardSearch } from '../hooks/useDashboardSearch';
import { SearchField } from './SearchField';
import { SearchResults } from './SearchResults';
import { ActionRow } from './ActionRow';
import { PREVIEWS_LOCAL_STORAGE_KEY } from '../constants';

export interface Props {
  onCloseSearch: () => void;
}

export const DashboardSearch: FC<Props> = memo(({ onCloseSearch }) => {
  const { query, onQueryChange, onTagFilterChange, onTagAdd, onSortChange, onLayoutChange } = useSearchQuery({});
  const { results, loading, onToggleSection, onKeyDown } = useDashboardSearch(query, onCloseSearch);
  const theme = useTheme2();
  const styles = getStyles(theme);
  const previewsEnabled = config.featureToggles.dashboardPreviews;
  const [showPreviews, setShowPreviews] = useLocalStorage<boolean>(PREVIEWS_LOCAL_STORAGE_KEY, previewsEnabled);
  const onShowPreviewsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setShowPreviews(event.target.checked);
  };

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
              onShowPreviewsChange,
              onSortChange,
              onTagFilterChange,
              query,
              showPreviews,
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
              showPreviews={showPreviews}
            />
          </CustomScrollbar>
        </div>
      </div>
    </div>
  );
});

DashboardSearch.displayName = 'DashboardSearch';

export default DashboardSearch;

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    overlay: css`
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: ${theme.zIndex.sidemenu};
      position: fixed;
      background: ${theme.colors.background.canvas};

      ${theme.breakpoints.up('md')} {
        left: ${theme.components.sidemenu.width}px;
        z-index: ${theme.zIndex.navbarFixed + 1};
      }
    `,
    container: css`
      max-width: 1400px;
      margin: 0 auto;
      padding: ${theme.spacing(2)};

      height: 100%;

      ${theme.breakpoints.up('md')} {
        padding: ${theme.spacing(4)};
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
      padding-bottom: ${theme.spacing(3)};
    `,
  };
});
