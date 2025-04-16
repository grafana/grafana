import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import * as React from 'react';
import { ChangeEvent, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import {
  CoreApp,
  DataSourceApi,
  DataSourceInstanceSettings,
  GrafanaTheme2,
  LoadingState,
  PanelData,
  RelativeTimeRange,
  ThresholdsConfig,
  getDefaultRelativeTimeRange,
  rangeUtil,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { GraphThresholdsStyleMode, Icon, InlineField, Input, Stack, Tooltip, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { logInfo } from 'app/features/alerting/unified/Analytics';
import { QueryEditorRow } from 'app/features/query/components/QueryEditorRow';
import { AlertDataQuery, AlertQuery } from 'app/types/unified-alerting-dto';

import { RuleFormValues } from '../../types/rule-form';
import { msToSingleUnitDuration } from '../../utils/time';
import { ExpressionStatusIndicator } from '../expressions/ExpressionStatusIndicator';

import { QueryOptions } from './QueryOptions';
import { VizWrapper } from './VizWrapper';

export const DEFAULT_MAX_DATA_POINTS = 43200;
export const DEFAULT_MIN_INTERVAL = '1s';

export interface AlertQueryOptions {
  maxDataPoints?: number | undefined;
  minInterval?: string | undefined;
}

interface Props {
  data: PanelData;
  error?: Error;
  query: AlertQuery;
  queries: AlertQuery[];
  dsSettings: DataSourceInstanceSettings;
  onChangeDataSource: (settings: DataSourceInstanceSettings, index: number) => void;
  onChangeQuery: (query: DataQuery, index: number) => void;
  onChangeTimeRange?: (timeRange: RelativeTimeRange, index: number) => void;
  onRemoveQuery: (query: DataQuery) => void;
  onDuplicateQuery: (query: AlertQuery) => void;
  onRunQueries: () => void;
  index: number;
  thresholds: ThresholdsConfig;
  thresholdsType?: GraphThresholdsStyleMode;
  onChangeThreshold?: (thresholds: ThresholdsConfig, index: number) => void;
  condition: string | null;
  onSetCondition: (refId: string) => void;
  onChangeQueryOptions: (options: AlertQueryOptions, index: number) => void;
}

export const QueryWrapper = ({
  data,
  error,
  dsSettings,
  index,
  onChangeDataSource,
  onChangeQuery,
  onChangeTimeRange,
  onRunQueries,
  onRemoveQuery,
  onDuplicateQuery,
  query,
  queries,
  thresholds,
  thresholdsType,
  onChangeThreshold,
  condition,
  onSetCondition,
  onChangeQueryOptions,
}: Props) => {
  const styles = useStyles2(getStyles);
  const [dsInstance, setDsInstance] = useState<DataSourceApi>();
  const defaults = dsInstance?.getDefaultQuery ? dsInstance.getDefaultQuery(CoreApp.UnifiedAlerting) : {};

  const { getValues } = useFormContext<RuleFormValues>();
  const isSwitchModeEnabled = config.featureToggles.alertingQueryAndExpressionsStepMode ?? false;
  const isAdvancedMode = isSwitchModeEnabled ? getValues('editorSettings.simplifiedQueryEditor') !== true : true;

  const queryWithDefaults = {
    ...defaults,
    ...cloneDeep(query.model),
  };

  if (queryWithDefaults.datasource && queryWithDefaults.datasource?.uid !== query.datasourceUid) {
    logInfo('rule query datasource and datasourceUid mismatch', {
      queryModelDatasourceUid: queryWithDefaults.datasource?.uid || '',
      queryDatasourceUid: query.datasourceUid,
      datasourceType: query.model.datasource?.type || 'unknown type',
    });
    // There are occasions when the rule query model datasource UID and the datasourceUid do not match
    // It's unclear as to why this happens, but we need better visibility on why this happens,
    // so we log when it does, and make the query model datasource UID match the datasource UID
    // We already elsewhere work under the assumption that the datasource settings are fetched from the datasourceUid property

    // This check is necessary for some few cases where the datasource might be an string instead of an object
    // see: https://github.com/grafana/grafana/issues/96040 for more context
    if (typeof queryWithDefaults.datasource === 'object' && Boolean(queryWithDefaults.datasource)) {
      queryWithDefaults.datasource.uid = query.datasourceUid;
    } else {
      // if the datasource is a string, we need to convert it to an object, and populate the fields from the query model
      queryWithDefaults.datasource = {};
      queryWithDefaults.datasource.uid = query.datasourceUid;
      queryWithDefaults.datasource.type = query.model.datasource?.type;
      queryWithDefaults.datasource.apiVersion = query.model.datasource?.apiVersion;
    }
  }

  function SelectingDataSourceTooltip() {
    const styles = useStyles2(getStyles);
    return (
      <div className={styles.dsTooltip}>
        <Tooltip
          content={
            <Trans i18nKey="alerting.selecting-data-source-tooltip.tooltip-content">
              Not finding the data source you want? Some data sources are not supported for alerting. Click on the icon
              for more information.
            </Trans>
          }
        >
          <Icon
            name="info-circle"
            onClick={() =>
              window.open(
                ' https://grafana.com/docs/grafana/latest/alerting/fundamentals/data-source-alerting/',
                '_blank'
              )
            }
          />
        </Tooltip>
      </div>
    );
  }

  // TODO add a warning label here too when the data looks like time series data and is used as an alert condition
  function HeaderExtras({
    query,
    error,
    index,
    isAdvancedMode = true,
  }: {
    query: AlertQuery<AlertDataQuery>;
    error?: Error;
    index: number;
    isAdvancedMode?: boolean;
  }) {
    const queryOptions: AlertQueryOptions = {
      maxDataPoints: query.model.maxDataPoints,
      minInterval: query.model.intervalMs ? msToSingleUnitDuration(query.model.intervalMs) : undefined,
    };
    const alertQueryOptions: AlertQueryOptions = {
      maxDataPoints: queryOptions.maxDataPoints,
      minInterval: queryOptions.minInterval,
    };

    const isAlertCondition = condition === query.refId;

    return (
      <Stack direction="row" alignItems="center" gap={1}>
        <SelectingDataSourceTooltip />
        <QueryOptions
          onChangeTimeRange={onChangeTimeRange}
          query={query}
          queryOptions={alertQueryOptions}
          onChangeQueryOptions={onChangeQueryOptions}
          index={index}
        />
        {isAdvancedMode && (
          <ExpressionStatusIndicator
            onSetCondition={() => onSetCondition(query.refId)}
            isCondition={isAlertCondition}
          />
        )}
      </Stack>
    );
  }

  const showVizualisation = data.state !== LoadingState.NotStarted;
  // ⚠️ the query editors want the entire array of queries passed as "DataQuery" NOT "AlertQuery"
  // TypeScript isn't complaining here because the interfaces just happen to be compatible
  const editorQueries = cloneDeep(queries.map((query) => query.model));
  const range = rangeUtil.relativeToTimeRange(query.relativeTimeRange ?? getDefaultRelativeTimeRange());

  return (
    <Stack direction="column" gap={0.5}>
      <div className={styles.wrapper}>
        <QueryEditorRow<AlertDataQuery>
          hideRefId={!isAdvancedMode}
          hideActionButtons={!isAdvancedMode}
          collapsable={false}
          dataSource={dsSettings}
          onDataSourceLoaded={setDsInstance}
          onChangeDataSource={(settings) => onChangeDataSource(settings, index)}
          id={query.refId}
          index={index}
          key={query.refId}
          data={data}
          query={queryWithDefaults}
          onChange={(query) => onChangeQuery(query, index)}
          onRemoveQuery={onRemoveQuery}
          onAddQuery={() => onDuplicateQuery(cloneDeep(query))}
          onRunQuery={onRunQueries}
          queries={editorQueries}
          range={range}
          renderHeaderExtras={() => (
            <HeaderExtras query={query} index={index} error={error} isAdvancedMode={isAdvancedMode} />
          )}
          app={CoreApp.UnifiedAlerting}
          hideHideQueryButton={true}
        />
      </div>
      {showVizualisation && <VizWrapper data={data} thresholds={thresholds} thresholdsType={thresholdsType} />}
    </Stack>
  );
};

export const EmptyQueryWrapper = ({ children }: React.PropsWithChildren<{}>) => {
  const styles = useStyles2(getStyles);
  return <div className={styles.wrapper}>{children}</div>;
};

export function MaxDataPointsOption({
  options,
  onChange,
}: {
  options: AlertQueryOptions;
  onChange: (options: AlertQueryOptions) => void;
}) {
  const value = options.maxDataPoints ?? '';

  const onMaxDataPointsBlur = (event: ChangeEvent<HTMLInputElement>) => {
    const maxDataPointsNumber = parseInt(event.target.value, 10);

    const maxDataPoints = isNaN(maxDataPointsNumber) || maxDataPointsNumber === 0 ? undefined : maxDataPointsNumber;

    if (maxDataPoints !== options.maxDataPoints) {
      onChange({
        ...options,
        maxDataPoints,
      });
    }
  };

  return (
    <InlineField
      labelWidth={24}
      label={t('alerting.max-data-points-option.label-max-data-points', 'Max data points')}
      tooltip={t(
        'alerting.max-data-points-option.tooltip-max-data-points',
        'The maximum data points per series. Used directly by some data sources and used in calculation of auto interval. With streaming data this value is used for the rolling buffer.'
      )}
    >
      <Input
        type="number"
        width={10}
        placeholder={DEFAULT_MAX_DATA_POINTS.toString()}
        spellCheck={false}
        onBlur={onMaxDataPointsBlur}
        defaultValue={value}
      />
    </InlineField>
  );
}

export function MinIntervalOption({
  options,
  onChange,
}: {
  options: AlertQueryOptions;
  onChange: (options: AlertQueryOptions) => void;
}) {
  const value = options.minInterval ?? '';

  const onMinIntervalBlur = (event: ChangeEvent<HTMLInputElement>) => {
    const minInterval = event.target.value;
    if (minInterval !== value) {
      onChange({
        ...options,
        minInterval,
      });
    }
  };

  return (
    <InlineField
      label={t('alerting.min-interval-option.label-interval', 'Interval')}
      labelWidth={24}
      tooltip={
        <Trans i18nKey="alerting.min-interval-option.tooltip-interval">
          Interval sent to the data source. Recommended to be set to write frequency, for example <code>1m</code> if
          your data is written every minute.
        </Trans>
      }
    >
      <Input
        type="text"
        width={10}
        placeholder={DEFAULT_MIN_INTERVAL}
        spellCheck={false}
        onBlur={onMinIntervalBlur}
        defaultValue={value}
      />
    </InlineField>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    label: 'AlertingQueryWrapper',
    marginBottom: theme.spacing(1),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,

    button: {
      overflow: 'visible',
    },
  }),
  dsTooltip: css({
    display: 'flex',
    alignItems: 'center',
    '&:hover': {
      opacity: 0.85,
      cursor: 'pointer',
    },
  }),
});
