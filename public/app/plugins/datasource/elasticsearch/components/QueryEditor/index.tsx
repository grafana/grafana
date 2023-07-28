import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { SemVer } from 'semver';

import { getDefaultTimeRange, GrafanaTheme2, QueryEditorProps } from '@grafana/data';
import { Alert, InlineField, InlineLabel, Input, QueryField, useStyles2 } from '@grafana/ui';

import { ElasticDatasource } from '../../datasource';
import { useNextId } from '../../hooks/useNextId';
import { useDispatch } from '../../hooks/useStatelessReducer';
import { ElasticsearchOptions, ElasticsearchQuery } from '../../types';
import { isSupportedVersion, isTimeSeriesQuery, unsupportedVersionMessage } from '../../utils';

import { BucketAggregationsEditor } from './BucketAggregationsEditor';
import { ElasticsearchProvider } from './ElasticsearchQueryContext';
import { MetricAggregationsEditor } from './MetricAggregationsEditor';
import { metricAggregationConfig } from './MetricAggregationsEditor/utils';
import { QueryTypeSelector } from './QueryTypeSelector';
import { changeAliasPattern, changeQuery } from './state';

export type ElasticQueryEditorProps = QueryEditorProps<ElasticDatasource, ElasticsearchQuery, ElasticsearchOptions>;

// a react hook that returns the elasticsearch database version,
// or `null`, while loading, or if it is not possible to determine the value.
function useElasticVersion(datasource: ElasticDatasource): SemVer | null {
  const [version, setVersion] = useState<SemVer | null>(null);
  useEffect(() => {
    let canceled = false;
    datasource.getDatabaseVersion().then(
      (version) => {
        if (!canceled) {
          setVersion(version);
        }
      },
      (error) => {
        // we do nothing
        console.log(error);
      }
    );

    return () => {
      canceled = true;
    };
  }, [datasource]);

  return version;
}

export const QueryEditor = ({ query, onChange, onRunQuery, datasource, range }: ElasticQueryEditorProps) => {
  const elasticVersion = useElasticVersion(datasource);
  const showUnsupportedMessage = elasticVersion != null && !isSupportedVersion(elasticVersion);
  return (
    <ElasticsearchProvider
      datasource={datasource}
      onChange={onChange}
      onRunQuery={onRunQuery}
      query={query}
      range={range || getDefaultTimeRange()}
    >
      {showUnsupportedMessage && <Alert title={unsupportedVersionMessage} />}
      <QueryEditorForm value={query} />
    </ElasticsearchProvider>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  root: css`
    display: flex;
  `,
  queryItem: css`
    flex-grow: 1;
    margin: 0 ${theme.spacing(0.5)} ${theme.spacing(0.5)} 0;
  `,
});

interface Props {
  value: ElasticsearchQuery;
}

export const ElasticSearchQueryField = ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.queryItem}>
      <QueryField query={value} onChange={onChange} placeholder="Enter a lucene query" portalOrigin="elasticsearch" />
    </div>
  );
};

const QueryEditorForm = ({ value }: Props) => {
  const dispatch = useDispatch();
  const nextId = useNextId();
  const styles = useStyles2(getStyles);

  const isTimeSeries = isTimeSeriesQuery(value);

  const showBucketAggregationsEditor = value.metrics?.every(
    (metric) => metricAggregationConfig[metric.type].impliedQueryType === 'metrics'
  );

  return (
    <>
      <div className={styles.root}>
        <InlineLabel width={17}>Query type</InlineLabel>
        <div className={styles.queryItem}>
          <QueryTypeSelector />
        </div>
      </div>
      <div className={styles.root}>
        <InlineLabel width={17}>Lucene Query</InlineLabel>
        <ElasticSearchQueryField onChange={(query) => dispatch(changeQuery(query))} value={value?.query} />

        {isTimeSeries && (
          <InlineField
            label="Alias"
            labelWidth={15}
            tooltip="Aliasing only works for timeseries queries (when the last group is 'Date Histogram'). For all other query types this field is ignored."
          >
            <Input
              id={`ES-query-${value.refId}_alias`}
              placeholder="Alias Pattern"
              onBlur={(e) => dispatch(changeAliasPattern(e.currentTarget.value))}
              defaultValue={value.alias}
            />
          </InlineField>
        )}
      </div>

      <MetricAggregationsEditor nextId={nextId} />
      {showBucketAggregationsEditor && <BucketAggregationsEditor nextId={nextId} />}
    </>
  );
};
