import { useCallback, useEffect, useMemo, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Stack } from '@grafana/ui';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { type CombinedRule } from 'app/types/unified-alerting';

import { GrafanaRuleQueryViewer, QueryPreview } from '../../../GrafanaRuleQueryViewer';
import { useAlertQueriesStatus } from '../../../hooks/useAlertQueriesStatus';
import { alertRuleToQueries } from '../../../utils/query';
import { isFederatedRuleGroup, rulerRuleType } from '../../../utils/rules';
import { useAlertQueryRunner } from '../../rule-editor/query-and-alert-condition/useAlertQueryRunner';
import { NoQueryToRun } from '../EvalStatus';

interface Props {
  rule: CombinedRule;
}

const QueryAndCondition = ({ rule }: Props) => {
  // Runner for expression results – evaluates the full original query DAG
  const {
    queryPreviewData: expressionData,
    runQueries: runExpressionQueries,
    isPreviewLoading: isExpressionLoading,
  } = useAlertQueryRunner();

  // Runner for data query visualizations – runs only data source queries converted to range
  const {
    queryPreviewData: visualizationData,
    runQueries: runVisualizationQueries,
    isPreviewLoading: isVisualizationLoading,
  } = useAlertQueryRunner();

  const queries = useMemo(() => alertRuleToQueries(rule), [rule]);

  // Convert instant data source queries to range for time-series visualization.
  // Expressions are excluded – they are evaluated separately with original queries.
  const visualizationQueries = useMemo(() => {
    return queries
      .filter((query) => !isExpressionQuery(query.model))
      .map((query) => {
        const model = { ...query.model };

        // Prometheus: uses boolean instant/range fields
        if ('instant' in model && model.instant === true) {
          model.instant = false;
          model.range = true;
        }

        // Loki: uses queryType enum field ('instant' | 'range' | 'stream')
        if ('queryType' in model && model.queryType === 'instant') {
          model.queryType = 'range';
        }

        return { ...query, model };
      });
  }, [queries]);

  const { allDataSourcesAvailable, isLoading: isDsLoading } = useAlertQueriesStatus(queries);

  // isPreviewLoading only turns true once a runner emits, which skips query preparation entirely
  // and lags the request by up to 200ms. Counted, so overlapping runs don't clear each other.
  const [activeRuns, setActiveRuns] = useState(0);

  const onRunQueries = useCallback(() => {
    if (queries.length === 0 || isDsLoading || !allDataSourcesAvailable) {
      return;
    }

    const condition = rulerRuleType.grafana.rule(rule.rulerRule) ? rule.rulerRule.grafana_alert.condition : 'A';

    setActiveRuns((runs) => runs + 1);
    void Promise.allSettled([
      runExpressionQueries(queries, condition),
      runVisualizationQueries(visualizationQueries, ''),
    ]).then(() => {
      setActiveRuns((runs) => runs - 1);
    });
  }, [
    queries,
    visualizationQueries,
    isDsLoading,
    allDataSourcesAvailable,
    rule.rulerRule,
    runExpressionQueries,
    runVisualizationQueries,
  ]);

  useEffect(() => {
    onRunQueries();
  }, [onRunQueries]);

  // Merge: visualization (range) data for data source queries, expression data for expressions
  const mergedPreviewData = useMemo(() => {
    return { ...expressionData, ...visualizationData };
  }, [expressionData, visualizationData]);

  const isFederatedRule = isFederatedRuleGroup(rule.group);

  // The visualization runner produces the range-converted query that draws the graph;
  // the expression runner runs the original raw queries + expression DAG that yield the result data.
  // Both include isDsLoading because the runners can only start once the data source availability
  // check has resolved — without it there is a gap where nothing reports loading yet.
  const queryGraphLoading = isDsLoading || activeRuns > 0 || isVisualizationLoading;
  const queryDataLoading = isDsLoading || activeRuns > 0 || isExpressionLoading;

  return (
    <>
      {rulerRuleType.grafana.rule(rule.rulerRule) && !isFederatedRule && (
        <GrafanaRuleQueryViewer
          rule={rule}
          condition={rule.rulerRule.grafana_alert.condition}
          queries={queries}
          evalDataByQuery={mergedPreviewData}
          queryGraphLoading={queryGraphLoading}
          queryDataLoading={queryDataLoading}
        />
      )}

      {!rulerRuleType.grafana.rule(rule.rulerRule) && !isFederatedRule && (
        <Stack direction="column" gap={1}>
          {queries.map((query) => {
            return (
              <QueryPreview
                key={query.refId}
                rule={rule}
                refId={query.refId}
                model={query.model}
                dataSource={Object.values(config.datasources).find((ds) => ds.uid === query.datasourceUid)}
                queryData={mergedPreviewData[query.refId]}
                relativeTimeRange={query.relativeTimeRange}
                isLoading={queryGraphLoading}
              />
            );
          })}
        </Stack>
      )}
      {!isFederatedRule && !isDsLoading && !allDataSourcesAvailable && (
        <Alert title={t('alerting.rule-view.query.datasources-na.title', 'Query not available')} severity="warning">
          <Trans i18nKey="alerting.rule-view.query.datasources-na.description">
            Cannot display the query preview. Some of the data sources used in the queries are not available.
          </Trans>
        </Alert>
      )}
      {/* No data source query to evaluate (e.g. an expression-only rule), so there is nothing to load. */}
      {!isFederatedRule && visualizationQueries.length === 0 && <NoQueryToRun />}
    </>
  );
};

export { QueryAndCondition };
