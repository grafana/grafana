import React, { FC, ReactNode } from 'react';
import { css } from '@emotion/css';
import {
  DataQuery,
  DataSourceInstanceSettings,
  GrafanaTheme2,
  PanelData,
  RelativeTimeRange,
  getDefaultRelativeTimeRange,
} from '@grafana/data';
import { useStyles2, RelativeTimeRangePicker } from '@grafana/ui';
import { QueryEditorRow } from '../../../../query/components/QueryEditorRow';
import { VizWrapper } from './VizWrapper';
import { isExpressionQuery } from '../../../../expressions/guards';
import { GrafanaQuery } from 'app/types/unified-alerting-dto';
import { cloneDeep } from 'lodash';

interface Props {
  data: PanelData;
  query: GrafanaQuery;
  queries: GrafanaQuery[];
  dsSettings: DataSourceInstanceSettings;
  onChangeDataSource: (settings: DataSourceInstanceSettings, index: number) => void;
  onChangeQuery: (query: DataQuery, index: number) => void;
  onChangeTimeRange?: (timeRange: RelativeTimeRange, index: number) => void;
  onRemoveQuery: (query: DataQuery) => void;
  onDuplicateQuery: (query: GrafanaQuery) => void;
  onRunQueries: () => void;
  index: number;
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
}) => {
  const styles = useStyles2(getStyles);
  const isExpression = isExpressionQuery(query.model);

  const renderTimePicker = (query: GrafanaQuery, index: number): ReactNode => {
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
      <QueryEditorRow
        dataSource={dsSettings}
        onChangeDataSource={!isExpression ? (settings) => onChangeDataSource(settings, index) : undefined}
        id={query.refId}
        index={index}
        key={query.refId}
        data={data}
        query={cloneDeep(query.model)}
        onChange={(query) => onChangeQuery(query, index)}
        onRemoveQuery={onRemoveQuery}
        onAddQuery={onDuplicateQuery}
        onRunQuery={onRunQueries}
        queries={queries}
        renderHeaderExtras={() => renderTimePicker(query, index)}
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
    padding-bottom: ${theme.spacing(1)};
  `,
});
