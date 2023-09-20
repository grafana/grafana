import { AnnotationEvent, arrayToDataFrame, DataTopic, getDefaultTimeRange, PanelData } from '@grafana/data';
import { config } from '@grafana/runtime';
import { dataLayers } from '@grafana/scenes';
import { AnnotationQuery, LoadingState } from '@grafana/schema';
import { PublicAnnotationsDataSource } from 'app/features/query/state/DashboardQueryRunner/PublicAnnotationsDataSource';

/**
 * This class is an extension to dataLayers.AnnotationsDataLayer to provide support for public dashboards.
 */
export class DashboardAnnotationsDataLayer extends dataLayers.AnnotationsDataLayer {
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

      stateUpdate.annotations = [df];

      return stateUpdate;
    } else {
      return super.processEvents(query, events);
    }
  }
}
