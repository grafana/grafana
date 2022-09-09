import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, QueryEditorProps, textUtil } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import OpenTsDatasource from '../datasource';
import { OpenTsdbOptions, OpenTsdbQuery } from '../types';

import { DownSample } from './DownSample';
import { MetricSection } from './MetricSection';

export type OpenTsdbQueryEditorProps = QueryEditorProps<OpenTsDatasource, OpenTsdbQuery, OpenTsdbOptions>;
export type OpenTsdbErrors = {
  downsampleInterval?: string;
  filters?: string;
  tags?: string;
};

export function OpenTsdbQueryEditor({
  datasource,
  onRunQuery,
  onChange,
  query,
  range,
  queries,
}: OpenTsdbQueryEditorProps) {
  const styles = useStyles2(getStyles);

  // errors will be updated so they need to be state
  // They are only displayed for tags, filters and downsampling.
  // There is evidence that metrics had errors at one point,
  // but there is no evidence it is being handled in the fromt end,
  // just errors delivered from the backend
  const [errors /*,setErrors*/] = useState<OpenTsdbErrors>({});

  // Xaggregators: any;
  // aggregators are updated potentially by datasource.getAggregators()
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

  // XfillPolicies: any;
  const fillPolicies: string[] = ['none', 'nan', 'null', 'zero'];

  // XfilterTypes: any;
  // filterTypes are potentially updated by datasource.getFilterTypes()
  const [filterTypes, setFilterTypes] = useState<string[]>([
    'wildcard',
    'iliteral_or',
    'not_iliteral_or',
    'not_literal_or',
    'iwildcard',
    'literal_or',
    'regexp',
  ]);
  // XtsdbVersion: any;
  const tsdbVersion: Number = datasource.tsdbVersion;

  // aggreagator only exists in the query
  // Xaggregator: any;

  // DownSample component
  // downsampleInterval: any;
  // downsampleAggregator: any;
  // downsampleFillPolicy: any;

  // errors: any;
  // Xlet suggestMetrics: any;
  // suggestTagKeys: any;
  // suggestTagValues: any;
  // addFilterMode = false;
  // const [addFilterMode, setFilterMode] = useState<boolean>(false);
  // addTagMode = false;
  // const [addTagMode, setTagMode] = useState<boolean>(false);

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
        <div>WIP</div>
        <div>Errors: {errors.toString()}</div>
        <div>FillPolicies: {fillPolicies[0].toString()}</div>
        <div>FilterTypes: {filterTypes[0].toString()}</div>
        <div>Version: {tsdbVersion.toString()}</div>
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
