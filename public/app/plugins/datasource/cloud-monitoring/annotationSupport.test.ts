import { AnnotationQuery } from '@grafana/data';

import { createMockDatasource } from './__mocks__/cloudMonitoringDatasource';
import { CloudMonitoringAnnotationSupport } from './annotationSupport';
import {
  AlignmentTypes,
  CloudMonitoringQuery,
  LegacyCloudMonitoringAnnotationQuery,
  MetricKind,
  QueryType,
} from './types';

const query: CloudMonitoringQuery = {
  refId: 'query',
  queryType: QueryType.ANNOTATION,
  intervalMs: 0,
  timeSeriesList: {
    projectName: 'project-name',
    filters: [],
    title: '',
    text: '',
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
          timeSeriesList: {
            crossSeriesReducer: 'REDUCE_NONE',
            filters: ['filter1', 'filter2'],
            perSeriesAligner: 'ALIGN_NONE',
            projectName: 'project-name',
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
    it('should ensure queryType is set to "annotation"', () => {
      const queryWithoutMetricsQueryType = { ...annotationQuery, queryType: 'blah' };
      expect(annotationSupport.prepareQuery?.(queryWithoutMetricsQueryType)).toEqual(
        expect.objectContaining({ queryType: QueryType.ANNOTATION })
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
