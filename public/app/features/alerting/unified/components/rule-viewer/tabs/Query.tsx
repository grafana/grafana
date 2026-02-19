import { useCallback, useEffect, useMemo } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Stack } from '@grafana/ui';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { CombinedRule } from 'app/types/unified-alerting';

import { GrafanaRuleQueryViewer, QueryPreview } from '../../../GrafanaRuleQueryViewer';
import { useAlertQueriesStatus } from '../../../hooks/useAlertQueriesStatus';
import { alertRuleToQueries } from '../../../utils/query';
import { isFederatedRuleGroup, rulerRuleType } from '../../../utils/rules';
import { useAlertQueryRunner } from '../../rule-editor/query-and-alert-condition/useAlertQueryRunner';

interface Props {
  rule: CombinedRule;
}

const QueryResults = ({ rule }: Props) => {
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
        if ('instant' in model) {
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

  const { allDataSourcesAvailable } = useAlertQueriesStatus(queries);

  const onRunQueries = useCallback(() => {
    if (queries.length > 0 && allDataSourcesAvailable) {
      let condition;
      if (rule && rulerRuleType.grafana.rule(rule.rulerRule)) {
        condition = rule.rulerRule.grafana_alert.condition;
      }
      // Run original queries for expression evaluation
      runExpressionQueries(queries, condition ?? 'A');
      // Run range-converted data source queries for visualization
      runVisualizationQueries(visualizationQueries, '');
    }
  }, [queries, visualizationQueries, allDataSourcesAvailable, rule, runExpressionQueries, runVisualizationQueries]);

  useEffect(() => {
    if (allDataSourcesAvailable) {
      onRunQueries();
    }
  }, [allDataSourcesAvailable, onRunQueries]);

  // Merge: visualization (range) data for data source queries, expression data for expressions
  const mergedPreviewData = useMemo(() => {
    return { ...expressionData, ...visualizationData };
  }, [expressionData, visualizationData]);

  const isFederatedRule = isFederatedRuleGroup(rule.group);
  const isPreviewLoading = isExpressionLoading || isVisualizationLoading;

  if (isPreviewLoading) {
    return <Trans i18nKey="alerting.common.loading">Loading...</Trans>;
  }

  return (
    <>
      {rulerRuleType.grafana.rule(rule.rulerRule) && !isFederatedRule && (
        <GrafanaRuleQueryViewer
          rule={rule}
          condition={rule.rulerRule.grafana_alert.condition}
          queries={queries}
          evalDataByQuery={mergedPreviewData}
        />
      )}

      {!rulerRuleType.grafana.rule(rule.rulerRule) &&
        !isFederatedRule &&
        mergedPreviewData &&
        Object.keys(mergedPreviewData).length > 0 && (
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
                />
              );
            })}
          </Stack>
        )}
      {!isFederatedRule && !allDataSourcesAvailable && (
        <Alert title={t('alerting.rule-view.query.datasources-na.title', 'Query not available')} severity="warning">
          <Trans i18nKey="alerting.rule-view.query.datasources-na.description">
            Cannot display the query preview. Some of the data sources used in the queries are not available.
          </Trans>
        </Alert>
      )}
    </>
  );
};

export { QueryResults };
