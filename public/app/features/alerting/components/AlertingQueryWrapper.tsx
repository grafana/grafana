import React, { FC } from 'react';
import { css } from '@emotion/css';
import { DataQuery, DataSourceInstanceSettings, GrafanaTheme2, PanelData, rangeUtil, TimeRange } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { QueryEditorRow } from '../../query/components/QueryEditorRow';
import { VizWrapper } from '../unified/components/rule-editor/VizWrapper';
import { isExpressionQuery } from '../../expressions/guards';
import { GrafanaQuery } from 'app/types/unified-alerting-dto';

interface Props {
  data: PanelData;
  query: GrafanaQuery;
  queries: GrafanaQuery[];
  dsSettings: DataSourceInstanceSettings;
  onChangeDataSource: (settings: DataSourceInstanceSettings, index: number) => void;
  onChangeQuery: (query: DataQuery, index: number) => void;
  onChangeTimeRange?: (timeRange: TimeRange, index: number) => void;
  onRemoveQuery: (query: DataQuery) => void;
  onDuplicateQuery: (query: GrafanaQuery) => void;
  onRunQueries: () => void;
  index: number;
}

export const AlertingQueryWrapper: FC<Props> = ({
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
}) => {
  const styles = useStyles2(getStyles);
  const isExpression = isExpressionQuery(query.model);

  return (
    <div className={styles.wrapper}>
      <QueryEditorRow
        dataSource={dsSettings}
        onChangeDataSource={!isExpression ? (settings) => onChangeDataSource(settings, index) : undefined}
        id={query.refId}
        index={index}
        key={query.refId}
        data={data}
        query={query.model}
        onChange={(query) => onChangeQuery(query, index)}
        timeRange={
          !isExpression && query.relativeTimeRange ? rangeUtil.relativeToTimeRange(query.relativeTimeRange) : undefined
        }
        onChangeTimeRange={
          !isExpression && onChangeTimeRange ? (timeRange) => onChangeTimeRange(timeRange, index) : undefined
        }
        onRemoveQuery={onRemoveQuery}
        onAddQuery={onDuplicateQuery}
        onRunQuery={onRunQueries}
        queries={queries}
      />
      {data && <VizWrapper data={data} defaultPanel={isExpression ? 'table' : 'timeseries'} />}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    margin-bottom: ${theme.spacing(1)};
    border: 1px solid ${theme.colors.border.medium};
    border-radius: ${theme.shape.borderRadius(1)};
    padding: ${theme.spacing(1)};
  `,
});
