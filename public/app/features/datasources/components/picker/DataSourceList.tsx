import { css, cx } from '@emotion/css';
import { useEffect } from 'react';
import * as React from 'react';
import { type Observable } from 'rxjs';

import {
  type DataSourceInstanceSettings,
  type DataSourceJsonData,
  type DataSourceRef,
  type GrafanaTheme2,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { type FavoriteDatasources, getTemplateSrv } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { SearchStatus } from '@grafana/ui/internal';

import { useRecentlyUsedDataSources } from '../../hooks';

import { AddNewDataSourceButton } from './AddNewDataSourceButton';
import { VirtualizedList } from './VirtualizedList';
import { buildDataSourceComparator, buildDataSourcePickerLookups, buildDataSourceSearchMatcher } from './utils';

/**
 * Component props description for the {@link DataSourceList}
 *
 * @internal
 */
export interface DataSourceListProps {
  className?: string;
  onChange: (ds: DataSourceInstanceSettings) => void;
  current: DataSourceRef | DataSourceInstanceSettings | string | null | undefined;
  keyboardEvents?: Observable<React.KeyboardEvent>;
  searchTerm?: string;
  nonSearchFilter?: (dataSource: DataSourceInstanceSettings) => boolean;
  onClickEmptyStateCTA?: () => void;
  enableKeyboardNavigation?: boolean;
  /** The data sources to list, already fetched with the list filter flags by the owner of the list */
  dataSources: Array<DataSourceInstanceSettings<DataSourceJsonData>>;
  favoriteDataSources: FavoriteDatasources;
  /** Ref to the scroll container element, used by the virtualizer */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** DOM id of the listbox, used to build option ids for aria-activedescendant */
  listboxId?: string;
  /** Reports the DOM id of the keyboard-highlighted option, for aria-activedescendant on the input */
  onActiveItemChange?: (id: string | undefined) => void;
  /** Show a focus ring on the highlighted option */
  showFocusRing?: boolean;
  /** Called once the list's rows are painted, with the count and whether a search term was already applied */
  onRendered?: (listedCount: number, searched: boolean) => void;
}

export function DataSourceList(props: DataSourceListProps) {
  const styles = useStyles2(getStyles);

  const {
    className,
    current,
    onChange,
    enableKeyboardNavigation,
    onClickEmptyStateCTA,
    favoriteDataSources,
    listboxId,
    onActiveItemChange,
    showFocusRing,
    scrollRef,
    onRendered,
  } = props;

  const [recentlyUsedDataSources, pushRecentlyUsedDataSource] = useRecentlyUsedDataSources();
  const sortedDataSources = useSortedDataSources(props, current, recentlyUsedDataSources, favoriteDataSources);

  // Reports after the list's rows are on screen, which is the slow part with 10k+ data sources. The
  // virtualizer only measures the scroll container and renders the visible rows after the first
  // commit, so wait two frames: the second callback runs after those rows have been painted.
  useEffect(() => {
    if (!onRendered) {
      return;
    }
    const listedCount = sortedDataSources.length;
    const searched = Boolean(props.searchTerm);
    let innerFrame = 0;
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => onRendered(listedCount, searched));
    });
    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchStatusMessage =
    sortedDataSources.length === 0
      ? t('data-source-picker.list.no-data-source-message', 'No data sources found')
      : t('data-source-picker.list.results-found', '', {
          count: sortedDataSources.length,
          defaultValue_one: '{{count}} data source found',
          defaultValue_other: '{{count}} data sources found',
        });

  return (
    <div className={cx(className, styles.container)} data-testid={selectors.components.DataSourcePicker.dataSourceList}>
      <SearchStatus message={searchStatusMessage} />
      {sortedDataSources.length === 0 && <EmptyState className={styles.emptyState} onClickCTA={onClickEmptyStateCTA} />}
      {sortedDataSources.length > 0 && (
        <VirtualizedList
          sortedDataSources={sortedDataSources}
          enableKeyboardNavigation={enableKeyboardNavigation}
          keyboardEvents={props.keyboardEvents}
          current={current}
          favoriteDataSources={favoriteDataSources}
          onChange={onChange}
          pushRecentlyUsedDataSource={pushRecentlyUsedDataSource}
          scrollRef={scrollRef}
          listboxId={listboxId}
          onActiveItemChange={onActiveItemChange}
          showFocusRing={showFocusRing}
        />
      )}
    </div>
  );
}

function useSortedDataSources(
  props: DataSourceListProps,
  current: DataSourceRef | DataSourceInstanceSettings | string | null | undefined,
  recentlyUsedDataSources: string[],
  favoriteDataSources: FavoriteDatasources
) {
  const { dataSources, searchTerm, nonSearchFilter } = props;
  const favoriteUids = favoriteDataSources.enabled ? favoriteDataSources.initialFavoriteDataSources : undefined;

  const lookups = buildDataSourcePickerLookups(
    dataSources,
    favoriteUids ?? [],
    recentlyUsedDataSources,
    getDataSourceVariableIDs()
  );
  const matchesSearch = buildDataSourceSearchMatcher(lookups, searchTerm ?? '');

  const results: DataSourceInstanceSettings[] = [];
  for (const ds of dataSources) {
    if (nonSearchFilter && !nonSearchFilter(ds)) {
      continue;
    }
    if (!matchesSearch(ds)) {
      continue;
    }
    results.push(ds);
  }
  results.sort(buildDataSourceComparator(current, lookups));
  return results;
}

function EmptyState({ className, onClickCTA }: { className?: string; onClickCTA?: () => void }) {
  const styles = useStyles2(getEmptyStateStyles);
  return (
    <div className={cx(className, styles.container)}>
      <p className={styles.message}>
        <Trans i18nKey="data-source-picker.list.no-data-source-message">No data sources found</Trans>
      </p>
      <AddNewDataSourceButton onClick={onClickCTA} />
    </div>
  );
}

function getEmptyStateStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    }),
    message: css({
      marginBottom: theme.spacing(3),
    }),
  };
}

function getDataSourceVariableIDs() {
  const templateSrv = getTemplateSrv();
  /** Unforunately there is no easy way to identify data sources that are variables. The uid of the data source will be the name of the variable in a templating syntax $([name]) **/
  return templateSrv
    .getVariables()
    .filter((v) => v.type === 'datasource')
    .map((v) => `\${${v.id}}`);
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(0.5),
      '[data-selecteditem="true"]': {
        backgroundColor: theme.colors.action.focus,
      },
    }),
    emptyState: css({
      height: '100%',
      flex: 1,
    }),
  };
}
