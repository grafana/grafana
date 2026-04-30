import { Observable } from 'rxjs';

import {
  type CorrelationSpec,
  generatedAPI as correlationsAPIv0alpha1,
} from '@grafana/api-clients/rtkq/correlations/v0alpha1';
import { type DataLinkTransformationConfig } from '@grafana/data';
import { type CorrelationData, getDataSourceSrv, reportInteraction, config } from '@grafana/runtime';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { type CreateCorrelationParams } from 'app/features/correlations/types';
import { createCorrelation, generateDefaultLabel, getCorrelationsFromStorage } from 'app/features/correlations/utils';
import { store } from 'app/store/store';
import { type ThunkResult } from 'app/types/store';

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
      const correlations = await getCorrelationsFromStorage(dispatch, pane.queries, pane.datasourceInstance.uid);
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
      const finalLabel = label || (await generateDefaultLabel(sourcePane, targetPane));

      if (config.featureToggles.kubernetesCorrelations) {
        const corrSpec: CorrelationSpec = {
          label: finalLabel,
          description: description,
          source: { group: sourceDatasource.type, name: sourceDatasource.uid },
          target: { group: targetDatasource.type, name: targetDatasource.uid },
          type: 'query',
          config: {
            field: targetPane.correlationEditorHelperData.resultField,
            target: targetPane.queries[0],
            transformations: transformations,
          },
        };

        // the generateName is discarded, but the server returns a 500 without it
        await dispatch(
          correlationsAPIv0alpha1.endpoints.createCorrelation.initiate({
            correlation: {
              metadata: { generateName: 'correlation-' },
              apiVersion: 'correlations.grafana.app/v0alpha1',
              kind: 'Correlation',
              spec: corrSpec,
            },
          })
        );
        await dispatch(reloadCorrelations(keys[0]));
        await dispatch(runQueries({ exploreId: keys[0] }));
        reportInteraction('grafana_explore_correlation_editor_saved', {
          sourceDatasourceType: sourceDatasource.type,
          targetDataSourceType: targetDatasource.type,
        });
      } else {
        const correlation: CreateCorrelationParams = {
          sourceUID: sourceDatasource.uid,
          targetUID: targetDatasource.uid,
          label: finalLabel,
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
    }
  };
}
