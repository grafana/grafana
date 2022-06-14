import { AnnotationQuery } from '@grafana/data';

import { CloudWatchAnnotationSupport } from './annotationSupport';
import { CloudWatchAnnotationQuery, LegacyAnnotationQuery } from './types';

const metricStatAnnotationQuery: CloudWatchAnnotationQuery = {
  queryMode: 'Annotations',
  region: 'us-east-2',
  namespace: 'AWS/EC2',
  period: '300',
  metricName: 'CPUUtilization',
  dimensions: { InstanceId: 'i-123' },
  matchExact: true,
  statistic: 'Average',
  refId: 'anno',
  prefixMatching: false,
  actionPrefix: '',
  alarmNamePrefix: '',
};

const prefixMatchingAnnotationQuery: CloudWatchAnnotationQuery = {
  queryMode: 'Annotations',
  region: 'us-east-2',
  namespace: '',
  period: '300',
  metricName: '',
  dimensions: undefined,
  statistic: 'Average',
  refId: 'anno',
  prefixMatching: true,
  actionPrefix: 'arn',
  alarmNamePrefix: 'test-alarm',
};

const annotationQuery: AnnotationQuery<CloudWatchAnnotationQuery> = {
  name: 'Anno',
  enable: false,
  iconColor: '',
  target: metricStatAnnotationQuery!,
};

const legacyAnnotationQuery: LegacyAnnotationQuery = {
  name: 'Anno',
  enable: false,
  iconColor: '',
  region: '',
  namespace: 'AWS/EC2',
  period: '300',
  metricName: 'CPUUtilization',
  dimensions: { InstanceId: 'i-123' },
  matchExact: true,
  statistic: '',
  refId: '',
  prefixMatching: false,
  actionPrefix: '',
  alarmNamePrefix: '',
  target: {
    limit: 0,
    matchAny: false,
    tags: [],
    type: '',
  },
  alias: '',
  builtIn: 0,
  datasource: undefined,
  expression: '',
  hide: false,
  id: '',
  type: '',
  statistics: [],
};

describe('annotationSupport', () => {
  describe('when prepareAnnotation', () => {
    describe('is being called with new style annotations', () => {
      it('should return the same query without changing it', () => {
        const preparedAnnotation = CloudWatchAnnotationSupport.prepareAnnotation(annotationQuery);
        expect(preparedAnnotation).toEqual(annotationQuery);
      });
    });

    describe('is being called with legacy annotations', () => {
      it('should return a new query', () => {
        const preparedAnnotation = CloudWatchAnnotationSupport.prepareAnnotation(legacyAnnotationQuery);
        expect(preparedAnnotation).not.toEqual(annotationQuery);
      });

      it('should set default values if not given', () => {
        const preparedAnnotation = CloudWatchAnnotationSupport.prepareAnnotation(legacyAnnotationQuery);
        expect(preparedAnnotation.target?.statistic).toEqual('Average');
        expect(preparedAnnotation.target?.region).toEqual('default');
        expect(preparedAnnotation.target?.queryMode).toEqual('Annotations');
        expect(preparedAnnotation.target?.refId).toEqual('annotationQuery');
      });

      it('should not set default values if given', () => {
        const annotation = CloudWatchAnnotationSupport.prepareAnnotation({
          ...legacyAnnotationQuery,
          statistic: 'Min',
          region: 'us-east-2',
          queryMode: 'Annotations',
          refId: 'A',
        });
        expect(annotation.target?.statistic).toEqual('Min');
        expect(annotation.target?.region).toEqual('us-east-2');
        expect(annotation.target?.queryMode).toEqual('Annotations');
        expect(annotation.target?.refId).toEqual('A');
      });
    });
  });

  describe('when prepareQuery', () => {
    describe('is being called without a target', () => {
      it('should return undefined', () => {
        const preparedQuery = CloudWatchAnnotationSupport.prepareQuery({
          ...annotationQuery,
          target: undefined,
        });
        expect(preparedQuery).toBeUndefined();
      });
    });

    describe('is being called with a complete metric stat query', () => {
      it('should return the annotation target', () => {
        expect(CloudWatchAnnotationSupport.prepareQuery(annotationQuery)).toEqual(annotationQuery.target);
      });
    });

    describe('is being called with an incomplete metric stat query', () => {
      it('should return undefined', () => {
        const preparedQuery = CloudWatchAnnotationSupport.prepareQuery({
          ...annotationQuery,
          target: {
            ...annotationQuery.target!,
            dimensions: {},
            metricName: '',
            statistic: undefined,
          },
        });
        expect(preparedQuery).toBeUndefined();
      });
    });

    describe('is being called with an incomplete prefix matching query', () => {
      it('should return the annotation target', () => {
        const query = {
          ...annotationQuery,
          target: prefixMatchingAnnotationQuery,
        };
        expect(CloudWatchAnnotationSupport.prepareQuery(query)).toEqual(query.target);
      });
    });

    describe('is being called with an incomplete prefix matching query', () => {
      it('should return undefined', () => {
        const query = {
          ...annotationQuery,
          target: {
            ...prefixMatchingAnnotationQuery,
            actionPrefix: '',
          },
        };
        expect(CloudWatchAnnotationSupport.prepareQuery(query)).toBeUndefined();
      });
    });
  });
});
