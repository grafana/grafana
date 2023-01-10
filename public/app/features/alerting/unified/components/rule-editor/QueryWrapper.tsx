import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React, { FC, useState } from 'react';

import {
  CoreApp,
  DataQuery,
  DataSourceInstanceSettings,
  getDefaultRelativeTimeRange,
  GrafanaTheme2,
  LoadingState,
  PanelData,
  RelativeTimeRange,
  ThresholdsConfig,
} from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { RelativeTimeRangePicker, useStyles2, Tooltip, Icon, GraphTresholdsStyleMode } from '@grafana/ui';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { QueryEditorRow } from 'app/features/query/components/QueryEditorRow';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { TABLE, TIMESERIES } from '../../utils/constants';
import { SupportedPanelPlugins } from '../PanelPluginsButtonGroup';
import { AlertConditionIndicator } from '../expressions/AlertConditionIndicator';

import { VizWrapper } from './VizWrapper';

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
  thresholdsType?: GraphTresholdsStyleMode;
  onChangeThreshold?: (thresholds: ThresholdsConfig, index: number) => void;
  condition: string | null;
  onSetCondition: (refId: string) => void;
}

export const QueryWrapper: FC<Props> = ({
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
}) => {
  const styles = useStyles2(getStyles);
  const isExpression = isExpressionQuery(query.model);
  const [pluginId, changePluginId] = useState<SupportedPanelPlugins>(isExpression ? TABLE : TIMESERIES);

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
    if (isExpressionQuery(query.model)) {
      return null;
    } else {
      return (
        <Stack direction="row" alignItems="center" gap={1}>
          <SelectingDataSourceTooltip />
          {onChangeTimeRange && (
            <RelativeTimeRangePicker
              timeRange={query.relativeTimeRange ?? getDefaultRelativeTimeRange()}
              onChange={(range) => onChangeTimeRange(range, index)}
            />
          )}
          <AlertConditionIndicator
            onSetCondition={() => onSetCondition(query.refId)}
            enabled={condition === query.refId}
            error={error}
          />
        </Stack>
      );
    }
  }

  return (
    <div className={styles.wrapper}>
      <QueryEditorRow<DataQuery>
        alerting
        dataSource={dsSettings}
        onChangeDataSource={!isExpression ? (settings) => onChangeDataSource(settings, index) : undefined}
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
              changePanel={changePluginId}
              currentPanel={pluginId}
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

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    label: AlertingQueryWrapper;
    margin-bottom: ${theme.spacing(1)};
    border: 1px solid ${theme.colors.border.medium};
    border-radius: ${theme.shape.borderRadius(1)};
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
