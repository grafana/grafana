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
import { RelativeTimeRangePicker, useStyles2, Tooltip, Icon } from '@grafana/ui';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { QueryEditorRow } from 'app/features/query/components/QueryEditorRow';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { TABLE, TIMESERIES } from '../../utils/constants';
import { SupportedPanelPlugins } from '../PanelPluginsButtonGroup';

import { VizWrapper } from './VizWrapper';

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

  function HeaderExtras({ query, index }: { query: AlertQuery; index: number }) {
    if (isExpressionQuery(query.model)) {
      return null;
    } else {
      return (
        <>
          <SelectingDataSourceTooltip />
          {onChangeTimeRange && (
            <RelativeTimeRangePicker
              timeRange={query.relativeTimeRange ?? getDefaultRelativeTimeRange()}
              onChange={(range) => onChangeTimeRange(range, index)}
            />
          )}
        </>
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
        renderHeaderExtras={() => <HeaderExtras query={query} index={index} />}
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

export const EmptyQueryWrapper: FC<{}> = ({ children }) => {
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
    margin-right: ${theme.spacing(2)};
    &:hover {
      opacity: 0.85;
      cursor: pointer;
    }
  `,
});
