import { Observable } from 'rxjs';

import { DataLinkTransformationConfig } from '@grafana/data';
import { CorrelationData, getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { CreateCorrelationParams } from 'app/features/correlations/types';
import { getCorrelationsBySourceUIDs, createCorrelation, generateDefaultLabel } from 'app/features/correlations/utils';
import { store } from 'app/store/store';
import { ThunkResult } from 'app/types';

import { saveCorrelationsAction } from './explorePane';
import { splitClose } from './main';
import { runQueries } from './query';

/**
 * Creates an observable that emits correlations once they are loaded
 */
export const getCorrelations = (exploreId: string) => {
  return new Observable<CorrelationData[]>((subscriber) => {
    const existingCorrelations = store.getState().explore.panes[exploreId]?.correlations;
    if (existingCorrelations) {
      subscriber.next(existingCorrelations);
      subscriber.complete();
    } else {
      const unsubscribe = store.subscribe(() => {
        const correlations = store.getState().explore.panes[exploreId]?.correlations;
        if (correlations) {
          unsubscribe();
          subscriber.next(correlations);
          subscriber.complete();
        }
      });
    }
  });
};

function reloadCorrelations(exploreId: string): ThunkResult<Promise<void>> {
  return async (dispatch, getState) => {
    const pane = getState().explore!.panes[exploreId]!;

    if (pane.datasourceInstance?.uid !== undefined) {
      // TODO: Tie correlations with query refID for mixed datasource
      let datasourceUIDs = pane.datasourceInstance.meta.mixed
        ? pane.queries.map((query) => query.datasource?.uid).filter((x): x is string => x !== null)
        : [pane.datasourceInstance.uid];
      const correlations = await getCorrelationsBySourceUIDs(datasourceUIDs);
      dispatch(saveCorrelationsAction({ exploreId, correlations: correlations.correlations || [] }));
    }
  };
}

export function saveCurrentCorrelation(
  label?: string,
  description?: string,
  transformations?: DataLinkTransformationConfig[]
): ThunkResult<Promise<void>> {
  return async (dispatch, getState) => {
    const keys = Object.keys(getState().explore?.panes);
    const sourcePane = getState().explore?.panes[keys[0]];
    const targetPane = getState().explore?.panes[keys[1]];
    if (!sourcePane || !targetPane) {
      return;
    }
    const sourceDatasourceRef = sourcePane.datasourceInstance?.meta.mixed
      ? sourcePane.queries[0].datasource
      : sourcePane.datasourceInstance?.getRef();
    const targetDataSourceRef = targetPane.datasourceInstance?.meta.mixed
      ? targetPane.queries[0].datasource
      : targetPane.datasourceInstance?.getRef();

    const [sourceDatasource, targetDatasource] = await Promise.all([
      getDataSourceSrv().get(sourceDatasourceRef),
      getDataSourceSrv().get(targetDataSourceRef),
    ]);

    if (sourceDatasource?.uid && targetDatasource?.uid && targetPane.correlationEditorHelperData?.resultField) {
      const correlation: CreateCorrelationParams = {
        sourceUID: sourceDatasource.uid,
        targetUID: targetDatasource.uid,
        label: label || (await generateDefaultLabel(sourcePane, targetPane)),
        description,
        type: 'query',
        config: {
          field: targetPane.correlationEditorHelperData.resultField,
          target: targetPane.queries[0],
          transformations: transformations,
        },
      };
      await createCorrelation(sourceDatasource.uid, correlation)
        .then(async () => {
          dispatch(splitClose(keys[1]));
          await dispatch(reloadCorrelations(keys[0]));
          await dispatch(runQueries({ exploreId: keys[0] }));
          reportInteraction('grafana_explore_correlation_editor_saved', {
            sourceDatasourceType: sourceDatasource.type,
            targetDataSourceType: targetDatasource.type,
          });
        })
        .catch((err) => {
          dispatch(notifyApp(createErrorNotification('Error creating correlation', err)));
          console.error(err);
        });
    }
  };
}
