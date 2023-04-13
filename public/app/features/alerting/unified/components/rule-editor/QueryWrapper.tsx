import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React, { ChangeEvent } from 'react';

import {
  CoreApp,
  DataQuery,
  DataSourceApi,
  DataSourceInstanceSettings,
  getDefaultRelativeTimeRange,
  GrafanaTheme2,
  LoadingState,
  PanelData,
  RelativeTimeRange,
  ThresholdsConfig,
} from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { getDataSourceSrv } from '@grafana/runtime';
import {
  GraphTresholdsStyleMode,
  Icon,
  InlineFormLabel,
  Input,
  RelativeTimeRangePicker,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { QueryEditorRow } from 'app/features/query/components/QueryEditorRow';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { AlertConditionIndicator } from '../expressions/AlertConditionIndicator';

import { VizWrapper } from './VizWrapper';

export const DEFAULT_MAX_DATA_POINTS = 43200;

export interface AlertQueryOptions {
  maxDataPoints?: number | undefined;
}

interface Props {
  data: PanelData;
  error?: Error;
  query: AlertQuery;
  queries: AlertQuery[];
  dsSettings: DataSourceInstanceSettings;
  onChangeDataSource: (instance: DataSourceApi, settings: DataSourceInstanceSettings, index: number) => void;
  onChangeQuery: (query: DataQuery, index: number) => void;
  onChangeTimeRange?: (timeRange: RelativeTimeRange, index: number) => void;
  onRemoveQuery: (query: DataQuery) => void;
  onDuplicateQuery: (query: AlertQuery) => void;
  onRunQueries: () => void;
  index: number;
  thresholds: ThresholdsConfig;
  thresholdsType?: GraphTresholdsStyleMode;
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

  function SelectingDataSourceTooltip() {
    const styles = useStyles2(getStyles);
    return (
      <div className={styles.dsTooltip}>
        <Tooltip
          content={
            <>
              Not finding the data source you want? Some data sources are not supported for alerting. Click on the icon
              for more information.
            </>
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
  function HeaderExtras({ query, error, index }: { query: AlertQuery; error?: Error; index: number }) {
    const queryOptions: AlertQueryOptions = { maxDataPoints: query.model.maxDataPoints };
    const alertQueryOptions: AlertQueryOptions = {
      maxDataPoints: queryOptions.maxDataPoints,
    };

    return (
      <Stack direction="row" alignItems="baseline" gap={1}>
        <SelectingDataSourceTooltip />
        {onChangeTimeRange && (
          <RelativeTimeRangePicker
            timeRange={query.relativeTimeRange ?? getDefaultRelativeTimeRange()}
            onChange={(range) => onChangeTimeRange(range, index)}
          />
        )}
        <div className={styles.queryOptions}>
          <MaxDataPointsOption
            options={alertQueryOptions}
            onChange={(options) => onChangeQueryOptions(options, index)}
          />
        </div>
        <AlertConditionIndicator
          onSetCondition={() => onSetCondition(query.refId)}
          enabled={condition === query.refId}
          error={error}
        />
      </Stack>
    );
  }

  return (
    <div className={styles.wrapper}>
      <QueryEditorRow<DataQuery>
        alerting
        dataSource={dsSettings}
        onChangeDataSource={(settings) => {
          getDataSourceSrv()
            .get({ type: settings.type, uid: settings.uid })
            .then((instance) => {
              onChangeDataSource(instance, settings, index);
            });
        }}
        id={query.refId}
        index={index}
        key={query.refId}
        data={data}
        query={cloneDeep(query.model)}
        onChange={(query) => onChangeQuery(query, index)}
        onRemoveQuery={onRemoveQuery}
        onAddQuery={() => onDuplicateQuery(cloneDeep(query))}
        onRunQuery={onRunQueries}
        queries={queries}
        renderHeaderExtras={() => <HeaderExtras query={query} index={index} error={error} />}
        app={CoreApp.UnifiedAlerting}
        visualization={
          data.state !== LoadingState.NotStarted ? (
            <VizWrapper
              data={data}
              thresholds={thresholds}
              thresholdsType={thresholdsType}
              onThresholdsChange={onChangeThreshold ? (thresholds) => onChangeThreshold(thresholds, index) : undefined}
            />
          ) : null
        }
        hideDisableQuery={true}
      />
    </div>
  );
};

export const EmptyQueryWrapper = ({ children }: React.PropsWithChildren<{}>) => {
  const styles = useStyles2(getStyles);
  return <div className={styles.wrapper}>{children}</div>;
};

function MaxDataPointsOption({
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
    <Stack direction="row" alignItems="baseline" gap={1}>
      <InlineFormLabel
        width={8}
        tooltip={
          <>
            The maximum data points per series. Used directly by some data sources and used in calculation of auto
            interval. With streaming data this value is used for the rolling buffer.
          </>
        }
      >
        Max data points
      </InlineFormLabel>
      <Input
        type="number"
        className="width-6"
        placeholder={DEFAULT_MAX_DATA_POINTS.toLocaleString()}
        spellCheck={false}
        onBlur={onMaxDataPointsBlur}
        defaultValue={value}
      />
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    label: AlertingQueryWrapper;
    margin-bottom: ${theme.spacing(1)};
    border: 1px solid ${theme.colors.border.medium};
    border-radius: ${theme.shape.borderRadius(1)};
  `,
  queryOptions: css`
    margin-bottom: -${theme.spacing(2)};
  `,
  dsTooltip: css`
    display: flex;
    align-items: center;
    &:hover {
      opacity: 0.85;
      cursor: pointer;
    }
  `,
});
