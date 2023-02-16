import { AnnotationSupport, AnnotationQuery } from '@grafana/data';

import { AnnotationQueryEditor } from './components/AnnotationQueryEditor';
import CloudMonitoringDatasource from './datasource';
import { AlignmentTypes, CloudMonitoringQuery, LegacyCloudMonitoringAnnotationQuery, QueryType } from './types';

// The legacy query format sets the title and text values to empty strings by default.
// If the title or text is not undefined at the top-level of the annotation target,
// then it is a legacy query.
const isLegacyCloudMonitoringAnnotation = (
  query: unknown
): query is AnnotationQuery<LegacyCloudMonitoringAnnotationQuery> =>
  (query as AnnotationQuery<LegacyCloudMonitoringAnnotationQuery>).target?.title !== undefined ||
  (query as AnnotationQuery<LegacyCloudMonitoringAnnotationQuery>).target?.text !== undefined;

export const CloudMonitoringAnnotationSupport: (
  ds: CloudMonitoringDatasource
) => AnnotationSupport<CloudMonitoringQuery> = (ds: CloudMonitoringDatasource) => {
  return {
    prepareAnnotation: (
      query: AnnotationQuery<LegacyCloudMonitoringAnnotationQuery> | AnnotationQuery<CloudMonitoringQuery>
    ): AnnotationQuery<CloudMonitoringQuery> => {
      if (!isLegacyCloudMonitoringAnnotation(query)) {
        return query;
      }

      const { enable, name, iconColor } = query;
      const { target } = query;
      const result: AnnotationQuery<CloudMonitoringQuery> = {
        datasource: query.datasource,
        enable,
        name,
        iconColor,
        target: {
          intervalMs: ds.intervalMs,
          refId: target?.refId || 'annotationQuery',
          queryType: QueryType.ANNOTATION,
          timeSeriesList: {
            projectName: target?.projectName || ds.getDefaultProject(),
            filters: target?.filters || [],
            crossSeriesReducer: 'REDUCE_NONE',
            perSeriesAligner: AlignmentTypes.ALIGN_NONE,
            title: target?.title || '',
            text: target?.text || '',
          },
        },
      };
      return result;
    },
    prepareQuery: (anno: AnnotationQuery<CloudMonitoringQuery>) => {
      if (!anno.target) {
        return undefined;
      }

      return {
        ...anno.target,
        queryType: QueryType.ANNOTATION,
        type: 'annotationQuery',
      };
    },
    QueryEditor: AnnotationQueryEditor,
  };
};
