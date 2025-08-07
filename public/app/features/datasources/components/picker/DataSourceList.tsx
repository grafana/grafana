import { css, cx } from '@emotion/css';
import { useRef } from 'react';
import * as React from 'react';
import { Observable } from 'rxjs';

import { DataSourceInstanceSettings, DataSourceJsonData, DataSourceRef, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { getTemplateSrv } from '@grafana/runtime';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { useDatasources, useKeyboardNavigatableList, useRecentlyUsedDataSources } from '../../hooks';

import { AddNewDataSourceButton } from './AddNewDataSourceButton';
import { DataSourceCard } from './DataSourceCard';
import { getDataSourceCompareFn, isDataSourceMatch } from './utils';

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
}

export function DataSourceList(props: DataSourceListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [navigatableProps, selectedItemCssSelector] = useKeyboardNavigatableList({
    keyboardEvents: props.keyboardEvents,
    containerRef: containerRef,
  });

  const theme = useTheme2();
  const styles = getStyles(theme, selectedItemCssSelector);

  const { className, current, onChange, enableKeyboardNavigation, onClickEmptyStateCTA } = props;
  const dataSources =
    props.dataSources ||
    useDatasources({
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
    });

  const [recentlyUsedDataSources, pushRecentlyUsedDataSource] = useRecentlyUsedDataSources();
  const filteredDataSources = props.filter ? dataSources.filter(props.filter) : dataSources;

  return (
    <div
      ref={containerRef}
      className={cx(className, styles.container)}
      data-testid={selectors.components.DataSourcePicker.dataSourceList}
    >
      {filteredDataSources.length === 0 && (
        <EmptyState className={styles.emptyState} onClickCTA={onClickEmptyStateCTA} />
      )}
      {filteredDataSources
        .sort(getDataSourceCompareFn(current, recentlyUsedDataSources, getDataSourceVariableIDs()))
        .map((ds) => (
          <DataSourceCard
            data-testid="data-source-card"
            key={ds.uid}
            ds={ds}
            onClick={() => {
              pushRecentlyUsedDataSource(ds);
              onChange(ds);
            }}
            selected={isDataSourceMatch(ds, current)}
            {...(enableKeyboardNavigation ? navigatableProps : {})}
          />
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

function getStyles(theme: GrafanaTheme2, selectedItemCssSelector: string) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(0.5),
      [`${selectedItemCssSelector}`]: {
        backgroundColor: theme.colors.background.secondary,
      },
    }),
    emptyState: css({
      height: '100%',
      flex: 1,
    }),
  };
}
