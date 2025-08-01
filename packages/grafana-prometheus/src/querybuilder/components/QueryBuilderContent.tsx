import { css } from '@emotion/css';
import { memo, useState } from 'react';

import { DataSourceApi, getDefaultTimeRange, PanelData } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { EditorRow } from '@grafana/plugin-ui';

import { PrometheusDatasource } from '../../datasource';
import { promqlGrammar } from '../../promql';
import { getInitHints } from '../../query_hints';
import { buildVisualQueryFromString } from '../parsing';
import { OperationExplainedBox } from '../shared/OperationExplainedBox';
import { OperationList } from '../shared/OperationList';
import { OperationListExplained } from '../shared/OperationListExplained';
import { OperationsEditorRow } from '../shared/OperationsEditorRow';
import { QueryBuilderHints } from '../shared/QueryBuilderHints';
import { RawQuery } from '../shared/RawQuery';
import { promQueryModeller } from '../shared/modeller_instance';
import { QueryBuilderOperation } from '../shared/types';
import { PromVisualQuery } from '../types';

import { MetricsLabelsSection } from './MetricsLabelsSection';
import { EXPLAIN_LABEL_FILTER_CONTENT } from './PromQueryBuilderExplained';

interface QueryBuilderContentProps {
  query: PromVisualQuery;
  datasource: PrometheusDatasource;
  onChange: (update: PromVisualQuery) => void;
  onRunQuery: () => void;
  data?: PanelData;
  showExplain: boolean;
}

export const QueryBuilderContent = memo<QueryBuilderContentProps>((props) => {
  const { datasource, query, onChange, onRunQuery, data, showExplain } = props;
  const [highlightedOp, setHighlightedOp] = useState<QueryBuilderOperation | undefined>();

  const lang = { grammar: promqlGrammar, name: 'promql' };
  const initHints = getInitHints(datasource);

  return (
    <>
      <EditorRow>
        <MetricsLabelsSection
          query={query}
          onChange={onChange}
          datasource={datasource}
          timeRange={data?.timeRange ?? getDefaultTimeRange()}
        />
      </EditorRow>
      {initHints.length ? (
        <div
          className={css({
            flexBasis: '100%',
          })}
        >
          <div className="text-warning">
            {initHints[0].label}{' '}
            {initHints[0].fix ? (
              <button type="button" className={'text-warning'}>
                {initHints[0].fix.label}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {showExplain && (
        <OperationExplainedBox
          stepNumber={1}
          title={<RawQuery query={`${promQueryModeller.renderQuery(query)}`} lang={lang} />}
        >
          {EXPLAIN_LABEL_FILTER_CONTENT}
        </OperationExplainedBox>
      )}
      <OperationsEditorRow>
        <OperationList<PromVisualQuery>
          queryModeller={promQueryModeller}
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          datasource={datasource as DataSourceApi}
          query={query}
          onChange={onChange}
          onRunQuery={onRunQuery}
          highlightedOp={highlightedOp}
          timeRange={data?.timeRange ?? getDefaultTimeRange()}
        />
        <div data-testid={selectors.components.DataSource.Prometheus.queryEditor.builder.hints}>
          <QueryBuilderHints
            datasource={datasource}
            query={query}
            onChange={onChange}
            data={data}
            queryModeller={promQueryModeller}
            buildVisualQueryFromString={buildVisualQueryFromString}
          />
        </div>
      </OperationsEditorRow>
      {showExplain && (
        <OperationListExplained<PromVisualQuery>
          lang={lang}
          query={query}
          stepNumber={2}
          queryModeller={promQueryModeller}
          onMouseEnter={(op: QueryBuilderOperation) => setHighlightedOp(op)}
          onMouseLeave={() => setHighlightedOp(undefined)}
        />
      )}
    </>
  );
});

QueryBuilderContent.displayName = 'QueryBuilderContent';
