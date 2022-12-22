import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, QueryEditorProps, textUtil } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import OpenTsDatasource from '../datasource';
import { OpenTsdbOptions, OpenTsdbQuery } from '../types';

import { DownSample } from './DownSample';
import { FilterSection } from './FilterSection';
import { MetricSection } from './MetricSection';
import { RateSection } from './RateSection';
import { TagSection } from './TagSection';

export type OpenTsdbQueryEditorProps = QueryEditorProps<OpenTsDatasource, OpenTsdbQuery, OpenTsdbOptions>;

export function OpenTsdbQueryEditor({
  datasource,
  onRunQuery,
  onChange,
  query,
  range,
  queries,
}: OpenTsdbQueryEditorProps) {
  const styles = useStyles2(getStyles);

  const [aggregators, setAggregators] = useState<string[]>([
    'avg',
    'sum',
    'min',
    'max',
    'dev',
    'zimsum',
    'mimmin',
    'mimmax',
  ]);

  const fillPolicies: string[] = ['none', 'nan', 'null', 'zero'];

  const [filterTypes, setFilterTypes] = useState<string[]>([
    'wildcard',
    'iliteral_or',
    'not_iliteral_or',
    'not_literal_or',
    'iwildcard',
    'literal_or',
    'regexp',
  ]);

  const tsdbVersion: number = datasource.tsdbVersion;

  if (!query.aggregator) {
    query.aggregator = 'sum';
  }

  if (!query.downsampleAggregator) {
    query.downsampleAggregator = 'avg';
  }

  if (!query.downsampleFillPolicy) {
    query.downsampleFillPolicy = 'none';
  }

  datasource.getAggregators().then((aggs: string[]) => {
    if (aggs.length !== 0) {
      setAggregators(aggs);
    }
  });

  datasource.getFilterTypes().then((filterTypes: string[]) => {
    if (filterTypes.length !== 0) {
      setFilterTypes(filterTypes);
    }
  });

  // previously called as an autocomplete on every input,
  // in this we call it once on init and filter in the MetricSection component
  async function suggestMetrics(): Promise<Array<{ value: string; description: string }>> {
    return datasource.metricFindQuery('metrics()').then(getTextValues);
  }

  // previously called as an autocomplete on every input,
  // in this we call it once on init and filter in the MetricSection component
  async function suggestTagValues(): Promise<Array<{ value: string; description: string }>> {
    return datasource.metricFindQuery('suggest_tagv()').then(getTextValues);
  }

  async function suggestTagKeys(query: OpenTsdbQuery): Promise<string[]> {
    return datasource.suggestTagKeys(query);
  }

  function getTextValues(metrics: Array<{ text: string }>) {
    return metrics.map((value: { text: string }) => {
      return {
        value: textUtil.escapeHtml(value.text),
        description: value.text,
      };
    });
  }

  return (
    <div className={styles.container} data-testid={testIds.editor}>
      <div className={styles.visualEditor}>
        <MetricSection
          query={query}
          onChange={onChange}
          onRunQuery={onRunQuery}
          suggestMetrics={suggestMetrics}
          aggregators={aggregators}
        />
        <DownSample
          query={query}
          onChange={onChange}
          onRunQuery={onRunQuery}
          aggregators={aggregators}
          fillPolicies={fillPolicies}
          tsdbVersion={tsdbVersion}
        />
        {tsdbVersion >= 2 && (
          <FilterSection
            query={query}
            onChange={onChange}
            onRunQuery={onRunQuery}
            filterTypes={filterTypes}
            suggestTagValues={suggestTagValues}
            suggestTagKeys={suggestTagKeys}
          />
        )}
        <TagSection
          query={query}
          onChange={onChange}
          onRunQuery={onRunQuery}
          suggestTagValues={suggestTagValues}
          suggestTagKeys={suggestTagKeys}
          tsdbVersion={tsdbVersion}
        />
        <RateSection query={query} onChange={onChange} onRunQuery={onRunQuery} tsdbVersion={tsdbVersion} />
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      display: flex;
    `,
    visualEditor: css`
      flex-grow: 1;
    `,
    toggleButton: css`
      margin-left: ${theme.spacing(0.5)};
    `,
  };
}

export const testIds = {
  editor: 'opentsdb-editor',
};
