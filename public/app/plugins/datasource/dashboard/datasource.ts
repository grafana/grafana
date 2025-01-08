import { Observable, defer, finalize, first, map, of, skip } from 'rxjs';

import {
  DataSourceApi,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  TestDataSourceResponse,
  ScopedVar,
  DataTopic,
  PanelData,
  DataFrame,
  LoadingState,
} from '@grafana/data';
import { SceneDataProvider, SceneDataTransformer, SceneObject } from '@grafana/scenes';
import {
  activateSceneObjectAndParentTree,
  findVizPanelByKey,
  getVizPanelKeyForPanelId,
} from 'app/features/dashboard-scene/utils/utils';

import { MIXED_REQUEST_PREFIX } from '../mixed/MixedDataSource';

import { DashboardQuery } from './types';

/**
 * This should not really be called
 */
export class DashboardDatasource extends DataSourceApi<DashboardQuery> {
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  getCollapsedText(query: DashboardQuery) {
    return `Dashboard Reference: ${query.panelId}`;
  }

  query(options: DataQueryRequest<DashboardQuery>): Observable<DataQueryResponse> {
    const sceneScopedVar: ScopedVar | undefined = options.scopedVars?.__sceneObject;
    let scene: SceneObject | undefined = sceneScopedVar ? (sceneScopedVar.value.valueOf() as SceneObject) : undefined;

    if (!scene) {
      throw new Error('Can only be called from a scene');
    }

    const query = options.targets[0];
    if (!query) {
      return of({ data: [] });
    }

    const panelId = query.panelId;

    if (!panelId) {
      return of({ data: [] });
    }

    let sourcePanel = this.findSourcePanel(scene, panelId);

    if (!sourcePanel) {
      return of({ data: [], error: { message: 'Could not find source panel' } });
    }

    let sourceDataProvider: SceneDataProvider | undefined = sourcePanel.state.$data;

    if (!query.withTransforms && sourceDataProvider instanceof SceneDataTransformer) {
      sourceDataProvider = sourceDataProvider.state.$data;
    }

    if (!sourceDataProvider || !sourceDataProvider.getResultsStream) {
      return of({ data: [] });
    }

    return defer(() => {
      if (!sourceDataProvider!.isActive && sourceDataProvider?.setContainerWidth) {
        sourceDataProvider?.setContainerWidth(500);
      }

      const cleanUp = activateSceneObjectAndParentTree(sourceDataProvider!);

      return sourceDataProvider!.getResultsStream!().pipe(
        map((result) => {
          return {
            data: this.getDataFramesForQueryTopic(result.data, query),
            state: result.data.state,
            errors: result.data.errors,
            error: result.data.error,
            key: 'source-ds-provider',
          };
        }),
        this.emitFirstLoadedDataIfMixedDS(options.requestId),
        finalize(() => cleanUp?.())
      );
    });
  }

  private getDataFramesForQueryTopic(data: PanelData, query: DashboardQuery): DataFrame[] {
    const annotations = data.annotations ?? [];
    if (query.topic === DataTopic.Annotations) {
      return annotations.map((frame) => ({
        ...frame,
        meta: {
          ...frame.meta,
          dataTopic: DataTopic.Series,
        },
      }));
    } else {
      return [...data.series, ...annotations];
    }
  }

  private findSourcePanel(scene: SceneObject, panelId: number) {
    return findVizPanelByKey(scene, getVizPanelKeyForPanelId(panelId));
  }

  private emitFirstLoadedDataIfMixedDS(
    requestId: string
  ): (source: Observable<DataQueryResponse>) => Observable<DataQueryResponse> {
    return (source: Observable<DataQueryResponse>) => {
      return requestId.includes(MIXED_REQUEST_PREFIX)
        ? source.pipe(
            // Scene QueryRunner has ReplaySubject on the result and first value will be previous
            //   result with state of DONE. Therefore we need to skip the first value
            skip(1),
            first((val) => val.state === LoadingState.Done || val.state === LoadingState.Error)
          )
        : source;
    };
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({ message: '', status: '' });
  }
}
