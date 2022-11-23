import { AnnotationQuery } from '@grafana/data';

import { createMockDatasource } from './__mocks__/cloudMonitoringDatasource';
import { CloudMonitoringAnnotationSupport } from './annotationSupport';
import {
  AlignmentTypes,
  CloudMonitoringQuery,
  EditorMode,
  LegacyCloudMonitoringAnnotationQuery,
  MetricKind,
  QueryType,
} from './types';

const query: CloudMonitoringQuery = {
  refId: 'query',
  queryType: QueryType.ANNOTATION,
  intervalMs: 0,
  metricQuery: {
    editorMode: EditorMode.Visual,
    projectName: 'project-name',
    metricType: '',
    filters: [],
    metricKind: MetricKind.GAUGE,
    valueType: '',
    title: '',
    text: '',
    query: '',
    crossSeriesReducer: 'REDUCE_NONE',
    perSeriesAligner: AlignmentTypes.ALIGN_NONE,
  },
};

const legacyQuery: LegacyCloudMonitoringAnnotationQuery = {
  projectName: 'project-name',
  metricType: 'metric-type',
  filters: ['filter1', 'filter2'],
  metricKind: MetricKind.CUMULATIVE,
  valueType: 'value-type',
  refId: 'annotationQuery',
  title: 'title',
  text: 'text',
};

const annotationQuery: AnnotationQuery<CloudMonitoringQuery> = {
  name: 'Anno',
  enable: false,
  iconColor: '',
  target: query,
};

const legacyAnnotationQuery: AnnotationQuery<LegacyCloudMonitoringAnnotationQuery> = {
  name: 'Anno',
  enable: false,
  iconColor: '',
  target: legacyQuery,
};

const ds = createMockDatasource();
const annotationSupport = CloudMonitoringAnnotationSupport(ds);

describe('CloudMonitoringAnnotationSupport', () => {
  describe('prepareAnnotation', () => {
    it('returns query if it is already a Cloud Monitoring annotation query', () => {
      expect(annotationSupport.prepareAnnotation?.(annotationQuery)).toBe(annotationQuery);
    });
    it('returns an updated query if it is a legacy Cloud Monitoring annotation query', () => {
      const expectedQuery = {
        datasource: undefined,
        enable: false,
        iconColor: '',
        name: 'Anno',
        target: {
          intervalMs: 0,
          metricQuery: {
            crossSeriesReducer: 'REDUCE_NONE',
            editorMode: 'visual',
            filters: ['filter1', 'filter2'],
            metricKind: 'CUMULATIVE',
            metricType: 'metric-type',
            perSeriesAligner: 'ALIGN_NONE',
            projectName: 'project-name',
            query: '',
            text: 'text',
            title: 'title',
          },
          queryType: 'annotation',
          refId: 'annotationQuery',
        },
      };
      expect(annotationSupport.prepareAnnotation?.(legacyAnnotationQuery)).toEqual(expectedQuery);
    });
  });

  describe('prepareQuery', () => {
    it('should ensure queryType is set to "metrics"', () => {
      const queryWithoutMetricsQueryType = { ...annotationQuery, queryType: 'blah' };
      expect(annotationSupport.prepareQuery?.(queryWithoutMetricsQueryType)).toEqual(
        expect.objectContaining({ queryType: 'metrics' })
      );
    });
    it('should ensure type is set "annotationQuery"', () => {
      const queryWithoutAnnotationQueryType = { ...annotationQuery, type: 'blah' };
      expect(annotationSupport.prepareQuery?.(queryWithoutAnnotationQueryType)).toEqual(
        expect.objectContaining({ type: 'annotationQuery' })
      );
    });
    it('should return undefined if there is no query', () => {
      const queryWithUndefinedTarget = { ...annotationQuery, target: undefined };
      expect(annotationSupport.prepareQuery?.(queryWithUndefinedTarget)).toBeUndefined();
    });
  });
});
