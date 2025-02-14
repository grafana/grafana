import { useCallback, useEffect, useMemo } from 'react';

import { config } from '@grafana/runtime';
import { Alert, Stack } from '@grafana/ui';
import { CombinedRule } from 'app/types/unified-alerting';

import { GrafanaRuleQueryViewer, QueryPreview } from '../../../GrafanaRuleQueryViewer';
import { useAlertQueriesStatus } from '../../../hooks/useAlertQueriesStatus';
import { alertRuleToQueries } from '../../../utils/query';
import { isFederatedRuleGroup, isGrafanaRulerRule } from '../../../utils/rules';
import { useAlertQueryRunner } from '../../rule-editor/query-and-alert-condition/useAlertQueryRunner';

interface Props {
  rule: CombinedRule;
}

const QueryResults = ({ rule }: Props) => {
  const { queryPreviewData, runQueries, isPreviewLoading } = useAlertQueryRunner();

  const queries = useMemo(() => alertRuleToQueries(rule), [rule]);

  const { allDataSourcesAvailable } = useAlertQueriesStatus(queries);

  const onRunQueries = useCallback(() => {
    if (queries.length > 0 && allDataSourcesAvailable) {
      let condition;
      if (rule && isGrafanaRulerRule(rule.rulerRule)) {
        condition = rule.rulerRule.grafana_alert.condition;
      }
      runQueries(queries, condition ?? 'A');
    }
  }, [queries, allDataSourcesAvailable, rule, runQueries]);

  useEffect(() => {
    if (allDataSourcesAvailable) {
      onRunQueries();
    }
  }, [allDataSourcesAvailable, onRunQueries]);

  const isFederatedRule = isFederatedRuleGroup(rule.group);

  return (
    <>
      {isPreviewLoading ? (
        'Loading...'
      ) : (
        <>
          {isGrafanaRulerRule(rule.rulerRule) && !isFederatedRule && (
            <GrafanaRuleQueryViewer
              rule={rule}
              condition={rule.rulerRule.grafana_alert.condition}
              queries={queries}
              evalDataByQuery={queryPreviewData}
            />
          )}

          {!isGrafanaRulerRule(rule.rulerRule) &&
            !isFederatedRule &&
            queryPreviewData &&
            Object.keys(queryPreviewData).length > 0 && (
              <Stack direction="column" gap={1}>
                {queries.map((query) => {
                  return (
                    <QueryPreview
                      key={query.refId}
                      rule={rule}
                      refId={query.refId}
                      model={query.model}
                      dataSource={Object.values(config.datasources).find((ds) => ds.uid === query.datasourceUid)}
                      queryData={queryPreviewData[query.refId]}
                      relativeTimeRange={query.relativeTimeRange}
                    />
                  );
                })}
              </Stack>
            )}
          {!isFederatedRule && !allDataSourcesAvailable && (
            <Alert title="Query not available" severity="warning">
              Cannot display the query preview. Some of the data sources used in the queries are not available.
            </Alert>
          )}
        </>
      )}
    </>
  );
};

export { QueryResults };
