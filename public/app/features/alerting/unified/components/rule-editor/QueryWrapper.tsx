import React, { FC, ReactNode, useState } from 'react';
import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
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
import { RelativeTimeRangePicker, useStyles2 } from '@grafana/ui';
import { QueryEditorRow } from 'app/features/query/components/QueryEditorRow';
import { VizWrapper } from './VizWrapper';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { TABLE, TIMESERIES } from '../../utils/constants';
import { SupportedPanelPlugins } from '../PanelPluginsButtonGroup';
import { AlertQuery } from 'app/types/unified-alerting-dto';

interface Props {
  data: PanelData;
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
  onChangeThreshold: (thresholds: ThresholdsConfig, index: number) => void;
}

export const QueryWrapper: FC<Props> = ({
  data,
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
  onChangeThreshold,
}) => {
  const styles = useStyles2(getStyles);
  const isExpression = isExpressionQuery(query.model);
  const [pluginId, changePluginId] = useState<SupportedPanelPlugins>(isExpression ? TABLE : TIMESERIES);

  const renderTimePicker = (query: AlertQuery, index: number): ReactNode => {
    if (isExpressionQuery(query.model) || !onChangeTimeRange) {
      return null;
    }

    return (
      <RelativeTimeRangePicker
        timeRange={query.relativeTimeRange ?? getDefaultRelativeTimeRange()}
        onChange={(range) => onChangeTimeRange(range, index)}
      />
    );
  };

  return (
    <div className={styles.wrapper}>
      <QueryEditorRow<DataQuery>
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
        renderHeaderExtras={() => renderTimePicker(query, index)}
        app={CoreApp.UnifiedAlerting}
        visualization={
          data.state !== LoadingState.NotStarted ? (
            <VizWrapper
              data={data}
              changePanel={changePluginId}
              currentPanel={pluginId}
              thresholds={thresholds}
              onThresholdsChange={(thresholds) => onChangeThreshold(thresholds, index)}
            />
          ) : null
        }
        hideDisableQuery={true}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    label: AlertingQueryWrapper;
    margin-bottom: ${theme.spacing(1)};
    border: 1px solid ${theme.colors.border.medium};
    border-radius: ${theme.shape.borderRadius(1)};
    padding-bottom: ${theme.spacing(1)};
  `,
});
