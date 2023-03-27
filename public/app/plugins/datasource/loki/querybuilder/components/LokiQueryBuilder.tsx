import React, { useEffect, useMemo, useState } from 'react';

import { DataSourceApi, getDefaultTimeRange, LoadingState, PanelData, SelectableValue } from '@grafana/data';
import { EditorRow } from '@grafana/experimental';
import { LabelFilters } from 'app/plugins/datasource/prometheus/querybuilder/shared/LabelFilters';
import { OperationExplainedBox } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationExplainedBox';
import { OperationList } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationList';
import { OperationListExplained } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationListExplained';
import { OperationsEditorRow } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationsEditorRow';
import { QueryBuilderHints } from 'app/plugins/datasource/prometheus/querybuilder/shared/QueryBuilderHints';
import { RawQuery } from 'app/plugins/datasource/prometheus/querybuilder/shared/RawQuery';
import {
  QueryBuilderLabelFilter,
  QueryBuilderOperation,
} from 'app/plugins/datasource/prometheus/querybuilder/shared/types';

import { testIds } from '../../components/LokiQueryEditor';
import { LokiDatasource } from '../../datasource';
import { escapeLabelValueInSelector } from '../../languageUtils';
import logqlGrammar from '../../syntax';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { LokiOperationId, LokiVisualQuery } from '../types';

import { EXPLAIN_LABEL_FILTER_CONTENT } from './LokiQueryBuilderExplained';
import { NestedQueryList } from './NestedQueryList';

export interface Props {
  query: LokiVisualQuery;
  datasource: LokiDatasource;
  showExplain: boolean;
  onChange: (update: LokiVisualQuery) => void;
  onRunQuery: () => void;
}
export const LokiQueryBuilder = React.memo<Props>(({ datasource, query, onChange, onRunQuery, showExplain }) => {
  const [sampleData, setSampleData] = useState<PanelData>();
  const [highlightedOp, setHighlightedOp] = useState<QueryBuilderOperation | undefined>(undefined);

  const onChangeLabels = (labels: QueryBuilderLabelFilter[]) => {
    onChange({ ...query, labels });
  };

  const withTemplateVariableOptions = async (optionsPromise: Promise<string[]>): Promise<SelectableValue[]> => {
    const options = await optionsPromise;
    return [...datasource.getVariables(), ...options].map((value) => ({ label: value, value }));
  };

  const onGetLabelNames = async (forLabel: Partial<QueryBuilderLabelFilter>): Promise<string[]> => {
    const labelsToConsider = query.labels.filter((x) => x !== forLabel);

    if (labelsToConsider.length === 0) {
      return await datasource.languageProvider.fetchLabels();
    }

    const expr = lokiQueryModeller.renderLabels(labelsToConsider);
    const series = await datasource.languageProvider.fetchSeriesLabels(expr);
    const labelsNamesToConsider = labelsToConsider.map((l) => l.label);

    const labelNames = Object.keys(series)
      // Filter out label names that are already selected
      .filter((name) => !labelsNamesToConsider.includes(name))
      .sort();

    return labelNames;
  };

  const onGetLabelValues = async (forLabel: Partial<QueryBuilderLabelFilter>) => {
    if (!forLabel.label) {
      return [];
    }

    let values;
    const labelsToConsider = query.labels.filter((x) => x !== forLabel);
    if (labelsToConsider.length === 0) {
      values = await datasource.languageProvider.fetchLabelValues(forLabel.label);
    } else {
      const expr = lokiQueryModeller.renderLabels(labelsToConsider);
      const result = await datasource.languageProvider.fetchSeriesLabels(expr);
      values = result[datasource.interpolateString(forLabel.label)];
    }

    return values ? values.map((v) => escapeLabelValueInSelector(v, forLabel.op)) : []; // Escape values in return
  };

  const labelFilterRequired: boolean = useMemo(() => {
    const { labels, operations: op } = query;
    if (!labels.length && op.length) {
      // Filter is required when operations are present (empty line contains operation is exception)
      if (op.length === 1 && op[0].id === LokiOperationId.LineContains && op[0].params[0] === '') {
        return false;
      }
      return true;
    }
    return false;
  }, [query]);

  useEffect(() => {
    const onGetSampleData = async () => {
      const lokiQuery = { expr: lokiQueryModeller.renderQuery(query), refId: 'data-samples' };
      const series = await datasource.getDataSamples(lokiQuery);
      const sampleData = { series, state: LoadingState.Done, timeRange: getDefaultTimeRange() };
      setSampleData(sampleData);
    };

    onGetSampleData().catch(console.error);
  }, [datasource, query]);

  const lang = { grammar: logqlGrammar, name: 'logql' };
  return (
    <div data-testid={testIds.editor}>
      <EditorRow>
        <LabelFilters
          onGetLabelNames={(forLabel: Partial<QueryBuilderLabelFilter>) =>
            withTemplateVariableOptions(onGetLabelNames(forLabel))
          }
          onGetLabelValues={(forLabel: Partial<QueryBuilderLabelFilter>) =>
            withTemplateVariableOptions(onGetLabelValues(forLabel))
          }
          labelsFilters={query.labels}
          onChange={onChangeLabels}
          labelFilterRequired={labelFilterRequired}
        />
      </EditorRow>
      {showExplain && (
        <OperationExplainedBox
          stepNumber={1}
          title={<RawQuery query={`${lokiQueryModeller.renderLabels(query.labels)}`} lang={lang} />}
        >
          {EXPLAIN_LABEL_FILTER_CONTENT}
        </OperationExplainedBox>
      )}
      <OperationsEditorRow>
        <OperationList
          queryModeller={lokiQueryModeller}
          query={query}
          onChange={onChange}
          onRunQuery={onRunQuery}
          datasource={datasource as DataSourceApi}
          highlightedOp={highlightedOp}
        />
        <QueryBuilderHints<LokiVisualQuery>
          datasource={datasource}
          query={query}
          onChange={onChange}
          data={sampleData}
          queryModeller={lokiQueryModeller}
          buildVisualQueryFromString={buildVisualQueryFromString}
        />
      </OperationsEditorRow>
      {showExplain && (
        <OperationListExplained<LokiVisualQuery>
          stepNumber={2}
          queryModeller={lokiQueryModeller}
          query={query}
          lang={lang}
          onMouseEnter={(op) => {
            setHighlightedOp(op);
          }}
          onMouseLeave={() => {
            setHighlightedOp(undefined);
          }}
        />
      )}
      {query.binaryQueries && query.binaryQueries.length > 0 && (
        <NestedQueryList
          query={query}
          datasource={datasource}
          onChange={onChange}
          onRunQuery={onRunQuery}
          showExplain={showExplain}
        />
      )}
    </div>
  );
});

LokiQueryBuilder.displayName = 'LokiQueryBuilder';
