import React, { createContext, FunctionComponent, useContext, useEffect } from 'react';
import { ElasticDatasource } from '../datasource';
import { defaultMetricAgg, metricAggregationConfig } from '../query_def';
import { ElasticsearchQuery, NormalizedElasticsearchQuery, isNormalized, MetricAggregation } from '../types';
import { normalizeQuery } from '../utils';

const ElasticsearchQueryContext = createContext<NormalizedElasticsearchQuery | undefined>(undefined);
const ElasticsearchContext = createContext<ElasticDatasource | undefined>(undefined);
const ElasticsearchChangeContext = createContext<((query: ElasticsearchQuery) => void) | undefined>(undefined);

interface Props {
  query: ElasticsearchQuery;
  onChange: (query: ElasticsearchQuery) => void;
  datasource: ElasticDatasource;
}

export const ElasticsearchQueryProvider: FunctionComponent<Props> = ({ children, onChange, query, datasource }) => {
  useEffect(() => {
    if (!isNormalized(query)) {
      onChange(normalizeQuery(query));
    }
  }, [query]);

  if (!isNormalized(query)) {
    return null;
  }

  return (
    <ElasticsearchContext.Provider value={datasource}>
      <ElasticsearchQueryContext.Provider value={query}>
        <ElasticsearchChangeContext.Provider value={onChange}>{children}</ElasticsearchChangeContext.Provider>
      </ElasticsearchQueryContext.Provider>
    </ElasticsearchContext.Provider>
  );
};

interface Thing {
  query: NormalizedElasticsearchQuery;
  addMetric: () => void;
  removeMetric: (index: number) => void;
  changeMetric: (index: number) => (newMetric: MetricAggregation) => void;
  onQueryChange: (queryString: string) => void;
}

export const useElasticsearchQuery = (): Thing => {
  const query = useContext(ElasticsearchQueryContext);
  const onChange = useContext(ElasticsearchChangeContext);

  if (!query || !onChange) {
    throw new Error('use ElasticsearchQueryProvider first.');
  }

  const addMetric = () => {
    const lastId = query.metrics[query.metrics.length - 1].id;
    onChange({
      ...query,
      metrics: [...query.metrics, defaultMetricAgg(lastId + 1)],
    });
  };

  const removeMetric = (index: number) => {
    onChange({
      ...query,
      metrics: query.metrics.slice(0, index).concat(query.metrics.slice(index + 1)),
    });
  };

  const changeMetric = (index: number) => (newMetric: MetricAggregation) => {
    const newMetrics = !!metricAggregationConfig[newMetric.type].isSingleMetric
      ? [newMetric]
      : query.metrics
          .slice(0, index)
          .concat(newMetric)
          .concat(query.metrics.slice(index + 1));

    onChange({
      ...query,
      metrics: newMetrics,
      // TODO: If raw_document or raw_data also clear bucketAggs
    });
  };

  const onQueryChange = (queryString: string) => {
    onChange({
      ...query,
      query: queryString,
    });
  };

  return { query, addMetric, removeMetric, changeMetric, onQueryChange };
};

export const useDatasource = () => {
  const datasource = useContext(ElasticsearchContext);
  if (!datasource) {
    throw new Error('use ElasticsearchQueryProvider first.');
  }

  return datasource;
};
