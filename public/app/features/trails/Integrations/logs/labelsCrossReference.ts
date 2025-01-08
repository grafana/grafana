import { filter, firstValueFrom, map } from 'rxjs';

import { LoadingState } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, sceneGraph, SceneQueryRunner } from '@grafana/scenes';

import { RelatedLogsScene } from '../../RelatedLogs/RelatedLogsScene';
import { VAR_FILTERS } from '../../shared';
import { getTrailFor } from '../../utils';

import { createMetricsLogsConnector, type FoundLokiDataSource } from './base';

export const createLabelsCrossReferenceConnector = (scene: RelatedLogsScene) => {
  const getLokiQueryExpr = (): string => {
    const trail = getTrailFor(scene);
    const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, trail);

    if (!(filtersVariable instanceof AdHocFiltersVariable)) {
      return '';
    }

    const { filters } = filtersVariable.state;
    const labelValuePairs = filters.length ? filters.map((filter) => `${filter.key}="${filter.value}"`) : [];

    if (!labelValuePairs.length) {
      return '';
    }

    return `{${labelValuePairs.join(',')}}`;
  };

  return createMetricsLogsConnector({
    async getDataSources(): Promise<FoundLokiDataSource[]> {
      const expr = getLokiQueryExpr();
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
              refId: `LabelXRef-${ds.uid}`,
              expr,
              maxLines: 1,
            },
          ],
          maxDataPoints: 1,
        });
        sqr.subscribeToState((newState) => {
          if (newState.data?.state === 'Done') {
            const hasLogs = Boolean(
              newState.data.series.at(0)?.fields.some((field) => field.name === 'labels' && field.values.length > 0)
            );
            if (hasLogs) {
              lokiDataSourcesWithRelatedLogs.push(ds);
            }
          }
        });
        sqr.activate();
        return sqr;
      });

      await Promise.all(
        queryRunners.map((runner) =>
          firstValueFrom(
            runner.getResultsStream().pipe(
              filter((result) => result.data.state !== LoadingState.Loading),
              map(() => undefined)
            )
          )
        )
      );

      return lokiDataSourcesWithRelatedLogs;
    },
    getLokiQueryExpr,
  });
};
