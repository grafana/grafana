// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/PromQueryBuilder.tsx
import { css } from '@emotion/css';
import { memo, useEffect, useState } from 'react';

import { DataSourceApi, PanelData } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { EditorRow } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Drawer, useStyles2 } from '@grafana/ui';

import { PrometheusDatasource } from '../../datasource';
import promqlGrammar from '../../promql';
import { promQueryModeller } from '../PromQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { OperationExplainedBox } from '../shared/OperationExplainedBox';
import { OperationList } from '../shared/OperationList';
import { OperationListExplained } from '../shared/OperationListExplained';
import { OperationsEditorRow } from '../shared/OperationsEditorRow';
import { QueryBuilderHints } from '../shared/QueryBuilderHints';
import { RawQuery } from '../shared/RawQuery';
import { QueryBuilderOperation } from '../shared/types';
import { PromVisualQuery } from '../types';

import { MetricsLabelsSection } from './MetricsLabelsSection';
import { NestedQueryList } from './NestedQueryList';
import { EXPLAIN_LABEL_FILTER_CONTENT } from './PromQueryBuilderExplained';
import { PromQail } from './promQail/PromQail';
import { QueryAssistantButton } from './promQail/QueryAssistantButton';
import { isLLMPluginEnabled } from './promQail/state/helpers';

export interface PromQueryBuilderProps {
  query: PromVisualQuery;
  datasource: PrometheusDatasource;
  onChange: (update: PromVisualQuery) => void;
  onRunQuery: () => void;
  data?: PanelData;
  showExplain: boolean;
}

export const PromQueryBuilder = memo<PromQueryBuilderProps>((props) => {
  const { datasource, query, onChange, onRunQuery, data, showExplain } = props;
  const [highlightedOp, setHighlightedOp] = useState<QueryBuilderOperation | undefined>();
  const [showDrawer, setShowDrawer] = useState<boolean>(false);
  const [llmAppEnabled, updateLlmAppEnabled] = useState<boolean>(false);
  const { prometheusPromQAIL } = config.featureToggles; // AI/ML + Prometheus

  const lang = { grammar: promqlGrammar, name: 'promql' };

  const initHints = datasource.getInitHints();

  useEffect(() => {
    async function checkLlms() {
      const check = await isLLMPluginEnabled();
      updateLlmAppEnabled(check);
    }

    if (prometheusPromQAIL) {
      checkLlms();
    }
  }, [prometheusPromQAIL]);
  const styles = useStyles2(getPromQueryBuilderStyles);

  return (
    <>
      {prometheusPromQAIL && showDrawer && (
        <Drawer closeOnMaskClick={false} onClose={() => setShowDrawer(false)}>
          <PromQail
            query={query}
            closeDrawer={() => setShowDrawer(false)}
            onChange={onChange}
            datasource={datasource}
          />
        </Drawer>
      )}
      <span className={styles.addaptToParent}>
        <EditorRow>
          <MetricsLabelsSection query={query} onChange={onChange} datasource={datasource} />
        </EditorRow>
      </span>

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
          title={<RawQuery query={`${query.metric} ${promQueryModeller.renderLabels(query.labels)}`} lang={lang} />}
        >
          {EXPLAIN_LABEL_FILTER_CONTENT}
        </OperationExplainedBox>
      )}
      <OperationsEditorRow>
        <OperationList<PromVisualQuery>
          queryModeller={promQueryModeller}
          // eslint-ignore
          datasource={datasource as DataSourceApi}
          query={query}
          onChange={onChange}
          onRunQuery={onRunQuery}
          highlightedOp={highlightedOp}
        />
        {prometheusPromQAIL && (
          <div
            className={css({
              padding: '0 0 0 6px',
            })}
          >
            <QueryAssistantButton llmAppEnabled={llmAppEnabled} metric={query.metric} setShowDrawer={setShowDrawer} />
          </div>
        )}
        <div data-testid={selectors.components.DataSource.Prometheus.queryEditor.builder.hints}>
          <QueryBuilderHints<PromVisualQuery>
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
          onMouseEnter={(op) => setHighlightedOp(op)}
          onMouseLeave={() => setHighlightedOp(undefined)}
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
    </>
  );
});
const getPromQueryBuilderStyles = () => ({
  addaptToParent: css({
    maxWidth: '100%',
  }),
});
PromQueryBuilder.displayName = 'PromQueryBuilder';
