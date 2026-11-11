import { css, cx } from '@emotion/css';
import { useMemo } from 'react';
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

import { useDatasources, useRecentlyUsedDataSources } from '../../hooks';

import { AddNewDataSourceButton } from './AddNewDataSourceButton';
import { VirtualizedList } from './VirtualizedList';
import {
  buildDataSourceComparator,
  buildDataSourcePickerLookups,
  buildDataSourceSearchMatcher,
  getDataSourceCompareFn,
} from './utils';

/**
 * Component props description for the {@link DataSourceList}
 *
 * @internal
 */
export interface DataSourceListProps {
  className?: string;
  onChange: (ds: DataSourceInstanceSettings) => void;
  current: DataSourceRef | DataSourceInstanceSettings | string | null | undefined;
  /** Would be nicer if these parameters were part of a filtering object */
  tracing?: boolean;
  mixed?: boolean;
  dashboard?: boolean;
  metrics?: boolean;
  type?: string | string[];
  annotations?: boolean;
  variables?: boolean;
  alerting?: boolean;
  pluginId?: string;
  /** If true,we show only DSs with logs; and if true, pluginId shouldnt be passed in */
  logs?: boolean;
  width?: number;
  keyboardEvents?: Observable<React.KeyboardEvent>;
  inputId?: string;
  filter?: (dataSource: DataSourceInstanceSettings) => boolean;
  searchTerm?: string;
  nonSearchFilter?: (dataSource: DataSourceInstanceSettings) => boolean;
  onClear?: () => void;
  onClickEmptyStateCTA?: () => void;
  enableKeyboardNavigation?: boolean;
  dataSources?: Array<DataSourceInstanceSettings<DataSourceJsonData>>;
  favoriteDataSources: FavoriteDatasources;
  /** Ref to the scroll container element, used by the virtualizer */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** DOM id of the listbox, used to build option ids for aria-activedescendant */
  listboxId?: string;
  /** Reports the DOM id of the keyboard-highlighted option, for aria-activedescendant on the input */
  onActiveItemChange?: (id: string | undefined) => void;
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
    scrollRef,
  } = props;

  const [recentlyUsedDataSources, pushRecentlyUsedDataSource] = useRecentlyUsedDataSources();
  const sortedDataSources = useSortedDataSources(props, current, recentlyUsedDataSources, favoriteDataSources);

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
  const dataSources = useDatasources(
    {
      alerting: props.alerting,
      annotations: props.annotations,
      dashboard: props.dashboard,
      logs: props.logs,
      metrics: props.metrics,
      mixed: props.mixed,
      pluginId: props.pluginId,
      tracing: props.tracing,
      type: props.type,
      variables: props.variables,
    },
    props.dataSources
  );

  const { searchTerm, nonSearchFilter, filter } = props;
  const favoriteUids = favoriteDataSources.enabled ? favoriteDataSources.initialFavoriteDataSources : undefined;
  const useFastPath = searchTerm !== undefined;

  // Scalar keys for array/object identities that commonly churn across renders (useFavoriteDatasources
  // returns fresh objects, useRecentlyUsedDataSources returns a fresh default [], etc). Joining on NUL
  // keeps the keys stable when contents are equal and distinct when they differ, without pulling the
  // identity-dependent references into the memo deps.
  const favoritesKey = (favoriteUids ?? []).join('\u0000');
  const recentKey = recentlyUsedDataSources.join('\u0000');

  const filteredLegacy = useFastPath ? dataSources : filter ? dataSources.filter(filter) : dataSources;

  return useMemo(() => {
    if (useFastPath) {
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

    return [...filteredLegacy].sort(
      getDataSourceCompareFn(current, recentlyUsedDataSources, getDataSourceVariableIDs(), favoriteUids)
    );
    // Keyed on scalars + `nonSearchFilter` identity. Callers must stabilize `nonSearchFilter` (e.g.,
    // with useCallback) to get the memoization benefit; an unstable identity invalidates every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useFastPath, dataSources, filteredLegacy, current, recentKey, favoritesKey, searchTerm, nonSearchFilter]);
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
