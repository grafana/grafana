import { produce } from 'immer';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useObservable } from 'react-use';

import { LoadingState, PanelData, RelativeTimeRange } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { CombinedRule } from 'app/types/unified-alerting';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { GrafanaRuleQueryViewer, QueryPreview } from '../../../GrafanaRuleQueryViewer';
import { useAlertQueriesStatus } from '../../../hooks/useAlertQueriesStatus';
import { AlertingQueryRunner } from '../../../state/AlertingQueryRunner';
import { alertRuleToQueries } from '../../../utils/query';
import { isFederatedRuleGroup, isGrafanaRulerRule } from '../../../utils/rules';

interface Props {
  rule: CombinedRule;
}

const QueryResults = ({ rule }: Props) => {
  const [evaluationTimeRanges, setEvaluationTimeRanges] = useState<Record<string, RelativeTimeRange>>({});

  const runner = useMemo(() => new AlertingQueryRunner(), []);
  const data = useObservable(runner.get());
  const loadingData = isLoading(data);

  const queries = useMemo(() => alertRuleToQueries(rule), [rule]);

  const { allDataSourcesAvailable } = useAlertQueriesStatus(queries);

  const onRunQueries = useCallback(() => {
    if (queries.length > 0 && allDataSourcesAvailable) {
      const evalCustomizedQueries = queries.map<AlertQuery>((q) => ({
        ...q,
        relativeTimeRange: evaluationTimeRanges[q.refId] ?? q.relativeTimeRange,
      }));

      let condition;
      if (rule && isGrafanaRulerRule(rule.rulerRule)) {
        condition = rule.rulerRule.grafana_alert.condition;
      }
      runner.run(evalCustomizedQueries, condition ?? 'A');
    }
  }, [queries, allDataSourcesAvailable, rule, runner, evaluationTimeRanges]);

  useEffect(() => {
    const alertQueries = alertRuleToQueries(rule);
    const defaultEvalTimeRanges = Object.fromEntries(
      alertQueries.map((q) => [q.refId, q.relativeTimeRange ?? { from: 0, to: 0 }])
    );

    setEvaluationTimeRanges(defaultEvalTimeRanges);
  }, [rule]);

  useEffect(() => {
    if (allDataSourcesAvailable) {
      onRunQueries();
    }
  }, [allDataSourcesAvailable, onRunQueries]);

  useEffect(() => {
    return () => runner.destroy();
  }, [runner]);

  const onQueryTimeRangeChange = useCallback(
    (refId: string, timeRange: RelativeTimeRange) => {
      const newEvalTimeRanges = produce(evaluationTimeRanges, (draft) => {
        draft[refId] = timeRange;
      });
      setEvaluationTimeRanges(newEvalTimeRanges);
    },
    [evaluationTimeRanges, setEvaluationTimeRanges]
  );

  const isFederatedRule = isFederatedRuleGroup(rule.group);

  return (
    <>
      {loadingData ? (
        'Loading...'
      ) : (
        <>
          {isGrafanaRulerRule(rule.rulerRule) && !isFederatedRule && (
            <GrafanaRuleQueryViewer
              condition={rule.rulerRule.grafana_alert.condition}
              queries={queries}
              evalDataByQuery={data}
              evalTimeRanges={evaluationTimeRanges}
              onTimeRangeChange={onQueryTimeRangeChange}
            />
          )}

          {!isGrafanaRulerRule(rule.rulerRule) && !isFederatedRule && data && Object.keys(data).length > 0 && (
            <div>
              {queries.map((query) => {
                return (
                  <QueryPreview
                    key={query.refId}
                    refId={query.refId}
                    model={query.model}
                    dataSource={Object.values(config.datasources).find((ds) => ds.uid === query.datasourceUid)}
                    queryData={data[query.refId]}
                    relativeTimeRange={query.relativeTimeRange}
                    evalTimeRange={evaluationTimeRanges[query.refId]}
                    onEvalTimeRangeChange={(timeRange) => onQueryTimeRangeChange(query.refId, timeRange)}
                    isAlertCondition={false}
                  />
                );
              })}
            </div>
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

function isLoading(data?: Record<string, PanelData>): boolean {
  if (!data) {
    return true;
  }

  return !!Object.values(data).find((d) => d.state === LoadingState.Loading);
}

export { QueryResults };
