import { css } from '@emotion/css';
import { useVirtualizer } from '@tanstack/react-virtual';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import type { DataSourceSettings } from '@grafana/data/types';
import { Trans, t } from '@grafana/i18n';
import { config, useFavoriteDatasources, type FavoriteDatasources } from '@grafana/runtime';
import { EmptyState, LinkButton, TextLink } from '@grafana/ui';
import { useStyles2, useTheme2 } from '@grafana/ui/themes';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { type StoreState, useSelector } from 'app/types/store';

import { ROUTES } from '../../connections/constants';
import {
  type DatasourceFailureDetails,
  useDatasourceFailureByUID,
} from '../../connections/hooks/useDatasourceAdvisorChecks';
import { useLoadDataSources } from '../state/hooks';
import { getDataSources, getDataSourcesCount } from '../state/selectors';
import { trackDataSourcesListViewed } from '../tracking';

import { DataSourcesListCard } from './DataSourcesListCard';
import { DataSourcesListHeader } from './DataSourcesListHeader';

const ROW_ESTIMATE_HEIGHT = 120;
const VIRTUAL_LIST_OVERSCAN = 5;
const VIRTUAL_LIST_KEYBOARD_OVERSCAN = 100;
const LOADING_SKELETON_COUNT = 20;
const VIRTUAL_LIST_INITIAL_RECT = { width: 0, height: 500 };

export function DataSourcesList() {
  const { isLoading } = useLoadDataSources();
  const favoriteDataSources = useFavoriteDatasources();
  const [queryParams, updateQueryParams] = useQueryParams();
  const showFavoritesOnly = !!queryParams.starred;
  const handleFavoritesCheckboxChange = (value: boolean) => {
    updateQueryParams({ starred: value ? 'true' : undefined });
  };

  const dataSources = useSelector((state) => getDataSources(state.dataSources));
  const dataSourcesCount = useSelector(({ dataSources }: StoreState) => getDataSourcesCount(dataSources));
  const hasCreateRights = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  const hasWriteRights = contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);
  const hasExploreRights = contextSrv.hasAccessToExplore();

  return (
    <DataSourcesListView
      dataSources={dataSources}
      dataSourcesCount={dataSourcesCount}
      isLoading={isLoading}
      hasCreateRights={hasCreateRights}
      hasWriteRights={hasWriteRights}
      hasExploreRights={hasExploreRights}
      showFavoritesOnly={showFavoritesOnly}
      handleFavoritesCheckboxChange={handleFavoritesCheckboxChange}
      favoriteDataSources={favoriteDataSources}
    />
  );
}

export type ViewProps = {
  dataSources: DataSourceSettings[];
  dataSourcesCount: number;
  isLoading: boolean;
  hasCreateRights: boolean;
  hasWriteRights: boolean;
  hasExploreRights: boolean;
  showFavoritesOnly?: boolean;
  handleFavoritesCheckboxChange?: (value: boolean) => void;
  favoriteDataSources?: FavoriteDatasources;
};

export function DataSourcesListView({
  dataSources: allDataSources,
  dataSourcesCount,
  isLoading,
  hasCreateRights,
  hasWriteRights,
  hasExploreRights,
  showFavoritesOnly,
  handleFavoritesCheckboxChange,
  favoriteDataSources,
}: ViewProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isKeyboardNavigating = useIsKeyboardNavigating();
  const { datasourceFailureByUID } = useDatasourceFailureByUID();
  const favoritesCheckbox =
    favoriteDataSources?.enabled && handleFavoritesCheckboxChange && showFavoritesOnly !== undefined
      ? {
          onChange: handleFavoritesCheckboxChange,
          value: showFavoritesOnly,
          label: t('datasources.list.starred', 'Starred'),
        }
      : undefined;

  // Filter data sources based on favorites when enabled
  const dataSources = useMemo(() => {
    if (!showFavoritesOnly || !favoriteDataSources?.enabled) {
      return allDataSources;
    }
    return allDataSources.filter((dataSource) => favoriteDataSources?.isFavoriteDatasource(dataSource.uid));
  }, [allDataSources, showFavoritesOnly, favoriteDataSources]);

  useEffect(() => {
    trackDataSourcesListViewed({
      grafana_version: config.buildInfo.version,
      path: location.pathname,
    });
  }, [location]);

  const rowGap = Number.parseFloat(theme.spacing(1)) || 8;
  const rowVirtualizer = useVirtualizer({
    count: dataSources.length,
    getItemKey: (index) => dataSources[index]?.uid ?? index,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE_HEIGHT,
    measureElement: (element) => {
      const measuredHeight = element.getBoundingClientRect().height;
      return measuredHeight > 0 ? measuredHeight : ROW_ESTIMATE_HEIGHT;
    },
    overscan: isKeyboardNavigating ? VIRTUAL_LIST_KEYBOARD_OVERSCAN : VIRTUAL_LIST_OVERSCAN,
    gap: rowGap,
    initialRect: VIRTUAL_LIST_INITIAL_RECT,
  });

  if (!isLoading && dataSourcesCount === 0) {
    return (
      <EmptyState
        variant="call-to-action"
        button={
          <LinkButton disabled={!hasCreateRights} href={ROUTES.DataSourcesNew} icon="database" size="lg">
            <Trans i18nKey="data-source-list.empty-state.button-title">Add data source</Trans>
          </LinkButton>
        }
        message={t('data-source-list.empty-state.title', 'No data sources defined')}
      >
        <Trans i18nKey="data-source-list.empty-state.pro-tip">
          You can also define data sources through configuration files.{' '}
          <TextLink
            external
            href="http://docs.grafana.org/administration/provisioning/?utm_source=grafana_ds_list#data-sources"
          >
            Learn more
          </TextLink>
        </Trans>
      </EmptyState>
    );
  }

  return (
    <div className={styles.container}>
      {/* List Header */}
      <DataSourcesListHeader filterCheckbox={favoritesCheckbox} />

      {/* List */}
      {dataSources.length === 0 && !isLoading && (
        <EmptyState variant="not-found" message={t('data-sources.empty-state.message', 'No data sources found')} />
      )}
      {isLoading && <DataSourcesListLoading hasExploreRights={hasExploreRights} />}
      {dataSources.length > 0 && !isLoading && (
        <DataSourcesListVirtualized
          dataSources={dataSources}
          hasWriteRights={hasWriteRights}
          hasExploreRights={hasExploreRights}
          datasourceFailureByUID={datasourceFailureByUID}
          scrollRef={scrollRef}
          rowVirtualizer={rowVirtualizer}
        />
      )}
    </div>
  );
}

function DataSourcesListLoading({ hasExploreRights }: { hasExploreRights: boolean }) {
  const styles = useStyles2(getStyles);

  return (
    <ul className={styles.loadingList} aria-label={t('data-sources.list.label', 'Data sources')}>
      {new Array(LOADING_SKELETON_COUNT).fill(null).map((_, index) => (
        <li key={index}>
          <DataSourcesListCard.Skeleton hasExploreRights={hasExploreRights} />
        </li>
      ))}
    </ul>
  );
}

interface DataSourcesListVirtualizedProps {
  dataSources: DataSourceSettings[];
  hasWriteRights: boolean;
  hasExploreRights: boolean;
  datasourceFailureByUID: Map<string, DatasourceFailureDetails>;
  scrollRef: RefObject<HTMLDivElement>;
  rowVirtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>;
}

function DataSourcesListVirtualized({
  dataSources,
  hasWriteRights,
  hasExploreRights,
  datasourceFailureByUID,
  scrollRef,
  rowVirtualizer,
}: DataSourcesListVirtualizedProps) {
  const styles = useStyles2(getStyles);

  return (
    <div ref={scrollRef} className={styles.listContainer}>
      <ul
        className={styles.virtualList}
        aria-label={t('data-sources.list.label', 'Data sources')}
        style={{ height: rowVirtualizer.getTotalSize() }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const dataSource = dataSources[virtualRow.index];
          if (!dataSource) {
            return null;
          }

          return (
            <li
              key={dataSource.uid}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              aria-setsize={dataSources.length}
              aria-posinset={virtualRow.index + 1}
              className={styles.virtualListItem}
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <DataSourcesListCard
                dataSource={dataSource}
                hasWriteRights={hasWriteRights}
                hasExploreRights={hasExploreRights}
                failure={datasourceFailureByUID.get(dataSource.uid)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function useIsKeyboardNavigating(): boolean {
  const [isKeyboardNavigating, setIsKeyboardNavigating] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        setIsKeyboardNavigating(true);
      }
    };

    const handlePointerDown = () => {
      setIsKeyboardNavigating(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return isKeyboardNavigating;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      height: '100%',
      minHeight: 0,
    }),
    loadingList: css({
      listStyle: 'none',
      display: 'grid',
      gap: theme.spacing(1),
      padding: 0,
      margin: 0,
    }),
    listContainer: css({
      overflowY: 'auto',
      flex: 1,
      minHeight: 0,
    }),
    virtualList: css({
      listStyle: 'none',
      position: 'relative',
      margin: 0,
      padding: 0,
      width: '100%',
    }),
    virtualListItem: css({
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
    }),
  };
};
