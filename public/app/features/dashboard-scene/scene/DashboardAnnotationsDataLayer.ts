import {
  type AnnotationEvent,
  arrayToDataFrame,
  DataTopic,
  getDefaultTimeRange,
  type PanelData,
  LoadingState,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { dataLayers } from '@grafana/scenes';
import { type AnnotationQuery } from '@grafana/schema';
import { PublicAnnotationsDataSource } from 'app/features/query/state/DashboardQueryRunner/PublicAnnotationsDataSource';

/**
 * This class is an extension to dataLayers.AnnotationsDataLayer to provide support for public dashboards.
 */
export class DashboardAnnotationsDataLayer extends dataLayers.AnnotationsDataLayer {
  public constructor(state: ConstructorParameters<typeof dataLayers.AnnotationsDataLayer>[0]) {
    super(state);

    // Scenes re-runs a layer on activation only when it has no data. A query cut off by deactivation, as section
    // layers are when their row or tab remounts, can leave a cancelled (error) or loading result that never recovers.
    this.addActivationHandler(() => {
      const loadingState = this.state.data?.state;
      if (this.state.isEnabled && (loadingState === LoadingState.Error || loadingState === LoadingState.Loading)) {
        this.runLayer();
      }
    });
  }

  protected async resolveDataSource(query: AnnotationQuery) {
    if (config.publicDashboardAccessToken) {
      return new PublicAnnotationsDataSource();
    }
    return super.resolveDataSource(query);
  }

  protected processEvents(
    query: AnnotationQuery,
    events: {
      state: LoadingState;
      events: AnnotationEvent[];
    }
  ) {
    if (config.publicDashboardAccessToken) {
      const stateUpdate: PanelData = {
        series: [],
        timeRange: getDefaultTimeRange(),
        state: events.state,
      };

      const df = arrayToDataFrame(events.events);
      df.meta = {
        ...df.meta,
        dataTopic: DataTopic.Annotations,
      };

      stateUpdate.series = [df];

      return stateUpdate;
    } else {
      return super.processEvents(query, events);
    }
  }
}
