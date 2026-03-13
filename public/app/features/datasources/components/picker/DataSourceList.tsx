import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as React from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { Observable } from 'rxjs';

import { DataSourceInstanceSettings, DataSourceJsonData, DataSourceRef, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { FavoriteDatasources, getTemplateSrv, reportInteraction } from '@grafana/runtime';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { useDatasources, useKeyboardNavigatableList, useRecentlyUsedDataSources } from '../../hooks';

import { AddNewDataSourceButton } from './AddNewDataSourceButton';
import { DataSourceCard } from './DataSourceCard';
import { INTERACTION_EVENT_NAME, INTERACTION_ITEM } from './DataSourcePicker';
import { getDataSourceCompareFn, isDataSourceMatch } from './utils';

const VIRTUALIZATION_MIN_ITEMS = 100;
const DATA_SOURCE_ROW_HEIGHT = 72;
const MAX_VISIBLE_ROWS = 8;

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
  onClear?: () => void;
  onClickEmptyStateCTA?: () => void;
  enableKeyboardNavigation?: boolean;
  dataSources?: Array<DataSourceInstanceSettings<DataSourceJsonData>>;
  favoriteDataSources: FavoriteDatasources;
}

export function DataSourceList(props: DataSourceListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const virtualizedListRef = useRef<FixedSizeList<DataSourceRowData>>(null);
  const [selectedVirtualizedIndex, setSelectedVirtualizedIndex] = useState(0);

  const theme = useTheme2();

  const { className, current, onChange, enableKeyboardNavigation, onClickEmptyStateCTA, favoriteDataSources } = props;
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

  const [recentlyUsedDataSources, pushRecentlyUsedDataSource] = useRecentlyUsedDataSources();

  const dataSourceVariableIDs = useMemo(() => getDataSourceVariableIDs(), []);
  const favoriteDataSourceIDs = favoriteDataSources.enabled ? favoriteDataSources.initialFavoriteDataSources : undefined;

  const filteredAndSortedDataSources = useMemo(() => {
    const filteredDataSources = props.filter ? dataSources.filter(props.filter) : dataSources;
    return [...filteredDataSources].sort(
      getDataSourceCompareFn(current, recentlyUsedDataSources, dataSourceVariableIDs, favoriteDataSourceIDs)
    );
  }, [props.filter, dataSources, current, recentlyUsedDataSources, dataSourceVariableIDs, favoriteDataSourceIDs]);

  const shouldVirtualize = filteredAndSortedDataSources.length >= VIRTUALIZATION_MIN_ITEMS;
  const [navigatableProps, selectedItemCssSelector] = useKeyboardNavigatableList({
    keyboardEvents: shouldVirtualize ? undefined : props.keyboardEvents,
    containerRef: containerRef,
  });
  const styles = getStyles(theme, selectedItemCssSelector);

  const selectDataSource = useCallback(
    (ds: DataSourceInstanceSettings) => {
      pushRecentlyUsedDataSource(ds);
      onChange(ds);
    },
    [onChange, pushRecentlyUsedDataSource]
  );

  useEffect(() => {
    if (!shouldVirtualize || !enableKeyboardNavigation) {
      return;
    }

    setSelectedVirtualizedIndex(0);
    virtualizedListRef.current?.scrollToItem(0, 'auto');
  }, [filteredAndSortedDataSources, shouldVirtualize, enableKeyboardNavigation]);

  useEffect(() => {
    if (!shouldVirtualize || !enableKeyboardNavigation || !props.keyboardEvents) {
      return;
    }

    const sub = props.keyboardEvents.subscribe({
      next: (keyEvent) => {
        if (filteredAndSortedDataSources.length === 0) {
          return;
        }

        switch (keyEvent?.code) {
          case 'ArrowDown': {
            setSelectedVirtualizedIndex((previousIndex) => {
              const nextIndex = Math.min(previousIndex + 1, filteredAndSortedDataSources.length - 1);
              virtualizedListRef.current?.scrollToItem(nextIndex, 'smart');
              return nextIndex;
            });
            keyEvent.preventDefault();
            break;
          }
          case 'ArrowUp': {
            setSelectedVirtualizedIndex((previousIndex) => {
              const nextIndex = previousIndex > 0 ? previousIndex - 1 : 0;
              virtualizedListRef.current?.scrollToItem(nextIndex, 'smart');
              return nextIndex;
            });
            keyEvent.preventDefault();
            break;
          }
          case 'Enter': {
            const selectedDs = filteredAndSortedDataSources[selectedVirtualizedIndex];
            if (selectedDs) {
              selectDataSource(selectedDs);
            }
            break;
          }
        }
      },
    });

    return () => sub.unsubscribe();
  }, [
    shouldVirtualize,
    enableKeyboardNavigation,
    props.keyboardEvents,
    filteredAndSortedDataSources,
    selectedVirtualizedIndex,
    selectDataSource,
  ]);

  return (
    <div
      ref={containerRef}
      className={cx(className, styles.container)}
      data-testid={selectors.components.DataSourcePicker.dataSourceList}
    >
      {filteredAndSortedDataSources.length === 0 && (
        <EmptyState className={styles.emptyState} onClickCTA={onClickEmptyStateCTA} />
      )}
      {!shouldVirtualize &&
        filteredAndSortedDataSources.map((ds) => (
          <DataSourceCard
            data-testid="data-source-card"
            key={ds.uid}
            ds={ds}
            onClick={() => {
              selectDataSource(ds);
            }}
            selected={isDataSourceMatch(ds, current)}
            isFavorite={favoriteDataSources.enabled ? favoriteDataSources.isFavoriteDatasource(ds.uid) : undefined}
            onToggleFavorite={
              favoriteDataSources.enabled
                ? () => {
                    reportInteraction(INTERACTION_EVENT_NAME, {
                      item: INTERACTION_ITEM.TOGGLE_FAVORITE,
                      ds_type: ds.type,
                      is_favorite: !favoriteDataSources.isFavoriteDatasource(ds.uid),
                    });
                    favoriteDataSources.isFavoriteDatasource(ds.uid)
                      ? favoriteDataSources.removeFavoriteDatasource(ds)
                      : favoriteDataSources.addFavoriteDatasource(ds);
                  }
                : undefined
            }
            {...(enableKeyboardNavigation ? navigatableProps : {})}
          />
        ))}
      {shouldVirtualize && (
        <FixedSizeList
          ref={virtualizedListRef}
          width="100%"
          itemCount={filteredAndSortedDataSources.length}
          itemSize={DATA_SOURCE_ROW_HEIGHT}
          height={Math.min(filteredAndSortedDataSources.length, MAX_VISIBLE_ROWS) * DATA_SOURCE_ROW_HEIGHT}
          itemData={{
            current,
            dataSources: filteredAndSortedDataSources,
            selectedIndex: selectedVirtualizedIndex,
            onChange: selectDataSource,
            favoriteDataSources,
            enableKeyboardNavigation,
          }}
        >
          {VirtualizedDataSourceRow}
        </FixedSizeList>
      )}
    </div>
  );
}

interface DataSourceRowData {
  current: DataSourceListProps['current'];
  dataSources: Array<DataSourceInstanceSettings<DataSourceJsonData>>;
  selectedIndex: number;
  onChange: (ds: DataSourceInstanceSettings) => void;
  favoriteDataSources: FavoriteDatasources;
  enableKeyboardNavigation?: boolean;
}

function VirtualizedDataSourceRow({ index, style, data }: ListChildComponentProps<DataSourceRowData>) {
  const ds = data.dataSources[index];

  if (!ds) {
    return null;
  }

  return (
    <div style={style}>
      <DataSourceCard
        data-testid="data-source-card"
        key={ds.uid}
        ds={ds}
        onClick={() => data.onChange(ds)}
        selected={isDataSourceMatch(ds, data.current)}
        isFavorite={data.favoriteDataSources.enabled ? data.favoriteDataSources.isFavoriteDatasource(ds.uid) : undefined}
        onToggleFavorite={
          data.favoriteDataSources.enabled
            ? () => {
                reportInteraction(INTERACTION_EVENT_NAME, {
                  item: INTERACTION_ITEM.TOGGLE_FAVORITE,
                  ds_type: ds.type,
                  is_favorite: !data.favoriteDataSources.isFavoriteDatasource(ds.uid),
                });
                data.favoriteDataSources.isFavoriteDatasource(ds.uid)
                  ? data.favoriteDataSources.removeFavoriteDatasource(ds)
                  : data.favoriteDataSources.addFavoriteDatasource(ds);
              }
            : undefined
        }
        {...(data.enableKeyboardNavigation
          ? {
              'data-role': 'keyboardSelectableItem',
              'data-selecteditem': index === data.selectedIndex ? 'true' : 'false',
            }
          : {})}
      />
    </div>
  );
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

function getStyles(theme: GrafanaTheme2, selectedItemCssSelector: string) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      padding: theme.spacing(0.5),
      [`${selectedItemCssSelector}`]: {
        backgroundColor: theme.colors.action.focus,
      },
    }),
    emptyState: css({
      height: '100%',
      flex: 1,
    }),
  };
}
