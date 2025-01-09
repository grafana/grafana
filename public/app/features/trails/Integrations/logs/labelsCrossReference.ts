import { filter, firstValueFrom, map } from 'rxjs';

import { LoadingState } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { sceneGraph, SceneQueryRunner } from '@grafana/scenes';

import { RelatedLogsScene } from '../../RelatedLogs/RelatedLogsScene';
import { VAR_FILTERS } from '../../shared';
import { getTrailFor, isAdHocVariable } from '../../utils';

import { createMetricsLogsConnector, type FoundLokiDataSource } from './base';

export const createLabelsCrossReferenceConnector = (scene: RelatedLogsScene) => {
  return createMetricsLogsConnector({
    async getDataSources(): Promise<FoundLokiDataSource[]> {
      // To establish if a data source has related logs, we run a query against each Loki data source
      // using the currently-applied filters. If the query returns a single log line, we consider the
      // data source to have related logs.
      const expr = this.getLokiQueryExpr();
      const lokiDataSources = getDataSourceSrv().getList({ logs: true, type: 'loki' });
      const lokiDataSourcesWithRelatedLogs: FoundLokiDataSource[] = [];
      const queryRunners = lokiDataSources.map((ds) => {
        const sqr = new SceneQueryRunner({
          datasource: {
            type: 'loki',
            uid: ds.uid,
          },
          queries: [
            {
              refId: `LabelCrossReference-${ds.uid}`,
              expr,
              maxLines: 1,
            },
          ],
          maxDataPoints: 1,
        });
        sqr.subscribeToState((newState) => {
          if (newState.data?.state !== LoadingState.Done) {
            return;
          }
          const hasLogs = Boolean(
            newState.data.series[0]?.fields.some((field) => field.name === 'labels' && field.values.length > 0)
          );
          if (hasLogs) {
            lokiDataSourcesWithRelatedLogs.push(ds);
          }
        });
        sqr.activate();
        return sqr;
      });

      // Wait for all queries to complete
      await Promise.all(
        queryRunners.map((runner) =>
          firstValueFrom(
            runner.getResultsStream().pipe(
              filter((result) => result.data.state !== LoadingState.Loading),
              map(() => undefined) // ignore the result, because we only care that the request has completed
            )
          )
        )
      );

      return lokiDataSourcesWithRelatedLogs;
    },
    getLokiQueryExpr(): string {
      const trail = getTrailFor(scene);
      const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, trail);

      if (!isAdHocVariable(filtersVariable) || !filtersVariable.state.filters.length) {
        return '';
      }

      const labelValuePairs = filtersVariable.state.filters.map(
        (filter) => `${replaceKnownLabelNames(filter.key)}${filter.operator}"${filter.value}"`
      );

      return `{${labelValuePairs.join(',')}}`; // e.g. `{environment="dev",region="us-west-1"}`
    },
  });
};

const knownLabelNameDiscrepancies = {
  job: 'service_name', // `service.name` is `job` in Mimir and `service_name` in Loki
  instance: 'service_instance_id', // `service.instance.id` is `instance` in Mimir and `service_instance_id` in Loki
};

function replaceKnownLabelNames(labelName: string): string {
  if (isLabelNameThatShouldBeReplaced(labelName)) {
    return knownLabelNameDiscrepancies[labelName];
  }

  return labelName;
}

function isLabelNameThatShouldBeReplaced(x: string): x is keyof typeof knownLabelNameDiscrepancies {
  return x in knownLabelNameDiscrepancies;
}
