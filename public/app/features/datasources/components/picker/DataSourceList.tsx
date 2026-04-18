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
import { Trans } from '@grafana/i18n';
import { type FavoriteDatasources, getTemplateSrv } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { useDatasources, useRecentlyUsedDataSources } from '../../hooks';

import { AddNewDataSourceButton } from './AddNewDataSourceButton';
import { StaticList } from './StaticList';
import { VirtualizedList } from './VirtualizedList';
import { getDataSourceCompareFn } from './utils';

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
  const styles = useStyles2(getStyles);

  const {
    className,
    current,
    onChange,
    enableKeyboardNavigation,
    onClickEmptyStateCTA,
    favoriteDataSources,
    scrollRef,
  } = props;

  const [recentlyUsedDataSources, pushRecentlyUsedDataSource] = useRecentlyUsedDataSources();
  const sortedDataSources = useSortedDataSources(props, current, recentlyUsedDataSources, favoriteDataSources);
  const shouldVirtualize = sortedDataSources.length >= VIRTUALIZATION_THRESHOLD;

  const sharedProps = {
    sortedDataSources,
    enableKeyboardNavigation,
    keyboardEvents: props.keyboardEvents,
    current,
    favoriteDataSources,
    onChange,
    pushRecentlyUsedDataSource,
    scrollRef,
  };

  return (
    <div className={cx(className, styles.container)} data-testid={selectors.components.DataSourcePicker.dataSourceList}>
      {sortedDataSources.length === 0 && <EmptyState className={styles.emptyState} onClickCTA={onClickEmptyStateCTA} />}
      {sortedDataSources.length > 0 && shouldVirtualize && <VirtualizedList {...sharedProps} />}
      {sortedDataSources.length > 0 && !shouldVirtualize && <StaticList {...sharedProps} />}
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

  const filteredDataSources = props.filter ? dataSources.filter(props.filter) : dataSources;

  return useMemo(
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
