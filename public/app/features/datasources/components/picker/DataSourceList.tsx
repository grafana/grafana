import { css, cx } from '@emotion/css';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useMemo, useRef } from 'react';
import * as React from 'react';
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

const VIRTUAL_OVERSCAN_ITEMS = 4;
const ESTIMATED_ITEM_HEIGHT = 48;
// Only virtualize when the list is large enough to benefit from it.
// Small lists render all items directly, which avoids issues with scroll
// container measurement in test environments and ensures all items are
// in the DOM for E2E test interactions.
const VIRTUALIZATION_THRESHOLD = 100;

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
  /** Ref to the scroll container element, used by the virtualizer */
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

export function DataSourceList(props: DataSourceListProps) {
  const theme = useTheme2();
  const styles = getStyles(theme);

  const {
    className,
    current,
    onChange,
    enableKeyboardNavigation,
    onClickEmptyStateCTA,
    favoriteDataSources,
    scrollRef,
  } = props;
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

  const filteredDataSources = props.filter ? dataSources.filter(props.filter) : dataSources;

  const sortedDataSources = useMemo(
    () =>
      [...filteredDataSources].sort(
        getDataSourceCompareFn(
          current,
          recentlyUsedDataSources,
          getDataSourceVariableIDs(),
          favoriteDataSources.enabled ? favoriteDataSources.initialFavoriteDataSources : undefined
        )
      ),
    [filteredDataSources, current, recentlyUsedDataSources, favoriteDataSources]
  );

  const shouldVirtualize = sortedDataSources.length >= VIRTUALIZATION_THRESHOLD;
  const shouldVirtualizeRef = useRef(shouldVirtualize);
  shouldVirtualizeRef.current = shouldVirtualize;

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? sortedDataSources.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ITEM_HEIGHT,
    overscan: VIRTUAL_OVERSCAN_ITEMS,
  });

  const virtualizerRef = useRef(rowVirtualizer);
  virtualizerRef.current = rowVirtualizer;

  const stableScrollToIndex = useCallback(
    (index: number) => {
      if (shouldVirtualizeRef.current) {
        virtualizerRef.current?.scrollToIndex(index, { align: 'auto' });
      } else {
        const container = scrollRef.current;
        if (container) {
          const items = container.querySelectorAll('[data-testid="data-source-card"]');
          items[index]?.scrollIntoView({ block: 'nearest' });
        }
      }
    },
    [scrollRef]
  );

  const handleSelect = useCallback(
    (index: number) => {
      const ds = sortedDataSources[index];
      if (ds) {
        pushRecentlyUsedDataSource(ds);
        onChange(ds);
      }
    },
    [sortedDataSources, onChange, pushRecentlyUsedDataSource]
  );

  const selectedIndex = useKeyboardNavigatableList({
    keyboardEvents: enableKeyboardNavigation ? props.keyboardEvents : undefined,
    itemCount: sortedDataSources.length,
    scrollToIndex: stableScrollToIndex,
    onSelect: handleSelect,
  });

  const renderDataSourceCard = (ds: DataSourceInstanceSettings, isSelected: boolean) => (
    <DataSourceCard
      data-testid="data-source-card"
      {...(enableKeyboardNavigation && {
        'data-selecteditem': isSelected ? 'true' : 'false',
      })}
      ds={ds}
      onClick={() => {
        pushRecentlyUsedDataSource(ds);
        onChange(ds);
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
    />
  );

  return (
    <div className={cx(className, styles.container)} data-testid={selectors.components.DataSourcePicker.dataSourceList}>
      {sortedDataSources.length === 0 && <EmptyState className={styles.emptyState} onClickCTA={onClickEmptyStateCTA} />}
      {sortedDataSources.length > 0 &&
        (shouldVirtualize ? (
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const ds = sortedDataSources[virtualRow.index];
              const isSelected = !!enableKeyboardNavigation && virtualRow.index === selectedIndex;
              return (
                <div
                  key={ds.uid}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {renderDataSourceCard(ds, isSelected)}
                </div>
              );
            })}
          </div>
        ) : (
          sortedDataSources.map((ds, index) => {
            const isSelected = !!enableKeyboardNavigation && index === selectedIndex;
            return <React.Fragment key={ds.uid}>{renderDataSourceCard(ds, isSelected)}</React.Fragment>;
          })
        ))}
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
