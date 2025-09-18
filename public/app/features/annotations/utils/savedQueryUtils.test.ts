// unit test for savedQuery utils
import { AnnotationQuery, DataSourceApi, CoreApp, AbstractQuery, AbstractLabelOperator } from '@grafana/data';
import { PromQuery } from '@grafana/prometheus';
import { DataQuery } from '@grafana/schema';

import { getDataQueryFromAnnotationForSavedQueries, updateAnnotationFromSavedQuery } from './savedQueryUtils';

// Mock the runtime service
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: jest.fn().mockResolvedValue({
      // Mock getDefaultQuery method for context-aware defaults
      getDefaultQuery: jest.fn(
        (app: CoreApp): Partial<PromQuery> => ({
          refId: 'A',
          expr: '',
          range: true,
          instant: false,
        })
      ),
      // Mock export/import methods for query normalization
      exportToAbstractQueries: jest.fn(async (queries: DataQuery[]): Promise<AbstractQuery[]> => {
        // Mock export: strip context properties, keep core content
        return queries.map(
          (query): AbstractQuery => ({
            refId: query.refId,
            labelMatchers: [
              { name: '__name__', operator: AbstractLabelOperator.Equal, value: (query as PromQuery).expr || 'up' },
            ],
          })
        );
      }),
      importFromAbstractQueries: jest.fn(async (abstractQueries: AbstractQuery[]): Promise<PromQuery[]> => {
        // Mock import: rebuild with appropriate defaults
        return abstractQueries.map(
          (abstractQuery): PromQuery => ({
            refId: abstractQuery.refId,
            expr: abstractQuery.labelMatchers?.[0]?.value || 'up',
            range: true, // Dashboard default
          })
        );
      }),
      annotations: {
        prepareAnnotation: (annotation: AnnotationQuery) => {
          // Mock realistic Prometheus preparation logic based on actual implementation
          // Handle legacy properties that might exist on old annotations
          const legacyAnnotation = annotation as AnnotationQuery & { expr?: string; step?: string; refId?: string };

          // Initialize target if it doesn't exist (Prometheus always creates target)
          if (!legacyAnnotation.target) {
            legacyAnnotation.target = {
              expr: '',
              refId: 'Anno',
            } as PromQuery;
          }

          // Cast target to PromQuery for type safety
          const currentTarget = legacyAnnotation.target as PromQuery;

          // Create a new target, preserving existing values when present
          legacyAnnotation.target = {
            ...currentTarget,
            refId: currentTarget.refId || legacyAnnotation.refId || 'Anno',
            expr: currentTarget.expr || legacyAnnotation.expr || '',
            interval: currentTarget.interval || legacyAnnotation.step || '',
          } as PromQuery;

          // Remove properties that have been transferred to target
          delete legacyAnnotation.expr;
          delete legacyAnnotation.step;
          delete legacyAnnotation.refId;

          return legacyAnnotation;
        },
      },
    }),
  }),
}));

describe('savedQueryUtils', () => {
  describe('getDataQueryFromAnnotationForSavedQueries', () => {
    it('should return a DataQuery object', () => {
      const annotationToSave: AnnotationQuery = {
        datasource: {
          type: 'prometheus',
          uid: 'prometheus',
        },
        target: {
          refId: 'Anno',
          expr: 'test',
          lines: 10,
        } as PromQuery,
        enable: true,
        iconColor: 'red',
        hide: false,
        name: 'super annotation prom',
      };

      const datasource = {
        uid: 'prometheus',
        type: 'prometheus',
        annotations: {
          prepareAnnotation: (annotation: AnnotationQuery) => annotation,
        },
      } as unknown as DataSourceApi;

      const result = getDataQueryFromAnnotationForSavedQueries(annotationToSave, datasource);
      expect(result).toEqual({
        refId: 'Anno',
        expr: 'test',
        lines: 10,
        datasource: {
          type: 'prometheus',
          uid: 'prometheus',
        },
      });
    });

    it('should handle v2 dashboard annotations with query.spec', () => {
      const v2Annotation: AnnotationQuery = {
        name: 'v2 annotation',
        query: {
          kind: 'prometheus',
          spec: {
            refId: 'A',
            expr: 'rate(http_requests_total[5m])',
            legendFormat: '{{method}}',
          } as PromQuery,
        },
        datasource: {
          type: 'prometheus',
          uid: 'prometheus-uid',
        },
        enable: true,
        iconColor: 'blue',
        hide: false,
      };

      const datasource = {
        uid: 'prometheus-uid',
        type: 'prometheus',
        annotations: {
          getDefaultQuery: () => ({ refId: 'Anno' }),
        },
      } as unknown as DataSourceApi;

      const result = getDataQueryFromAnnotationForSavedQueries(v2Annotation, datasource);

      expect(result).toEqual({
        refId: 'A',
        expr: 'rate(http_requests_total[5m])',
        legendFormat: '{{method}}',
        datasource: {
          type: 'prometheus',
          uid: 'prometheus-uid',
        },
      });
    });

    it('should use default query when no target or spec exists', () => {
      const annotationWithoutQuery: AnnotationQuery = {
        name: 'empty annotation',
        datasource: {
          type: 'prometheus',
          uid: 'prometheus-uid',
        },
        enable: true,
        iconColor: 'green',
        hide: false,
      };

      const datasource = {
        uid: 'prometheus-uid',
        type: 'prometheus',
        annotations: {
          getDefaultQuery: () => ({ refId: 'Anno', expr: 'up' }),
        },
      } as unknown as DataSourceApi;

      const result = getDataQueryFromAnnotationForSavedQueries(annotationWithoutQuery, datasource);

      expect(result).toEqual({
        refId: 'Anno',
        expr: 'up',
        datasource: {
          type: 'prometheus',
          uid: 'prometheus-uid',
        },
      });
    });

    it('should use refId "Anno" as fallback when no default query exists', () => {
      const annotationWithoutQuery: AnnotationQuery = {
        name: 'empty annotation',
        datasource: {
          type: 'testdata',
          uid: 'testdata-uid',
        },
        enable: true,
        iconColor: 'green',
      };

      const datasource = {
        uid: 'testdata-uid',
        type: 'testdata',
        annotations: {},
      } as unknown as DataSourceApi;

      const result = getDataQueryFromAnnotationForSavedQueries(annotationWithoutQuery, datasource);

      expect(result).toEqual({
        refId: 'Anno',
        datasource: {
          type: 'testdata',
          uid: 'testdata-uid',
        },
      });
    });
  });

  describe('updateAnnotationFromSavedQuery', () => {
    it('should update annotation with clean query structure (no datasource in target)', async () => {
      const annotation: AnnotationQuery = {
        name: 'initialAnn',
        target: { refId: 'Anno' },
        datasource: {
          type: 'prometheus',
          uid: 'old-prometheus',
        },
        enable: true,
        iconColor: 'red',
        hide: false,
      };

      const replacedQuery = {
        refId: 'A',
        expr: 'up',
        legendFormat: '__auto',
        interval: '60s',
        datasource: {
          type: 'prometheus',
          uid: 'new-prometheus',
        },
      } as DataQuery;

      const result = await updateAnnotationFromSavedQuery(annotation, replacedQuery);

      // the preparation for the annotation like the mock of prometheus datasource
      // removes the datasource from the target
      expect(result).toEqual({
        name: 'initialAnn',
        enable: true,
        iconColor: 'red',
        hide: false,
        builtIn: undefined,
        filter: undefined,
        mappings: undefined,
        type: undefined,
        datasource: {
          type: 'prometheus',
          uid: 'new-prometheus',
        },
        target: {
          refId: 'Anno', // refId should always be 'Anno' for annotations
          expr: 'up',
          legendFormat: '__auto',
          interval: '60s',
          instant: false, // Normalized for annotation context
          range: true, // Normalized for annotation context
        },
      });
    });

    it('should handle v2 dashboard annotations with query.spec', async () => {
      const v2Annotation: AnnotationQuery = {
        name: 'v2 annotation',
        query: {
          kind: 'prometheus',
          spec: {
            refId: 'A',
            expr: 'up',
          },
        },
        datasource: {
          type: 'prometheus',
          uid: 'original-prometheus',
        },
        enable: true,
        iconColor: 'blue',
        hide: false,
      };

      const replacedQuery = {
        refId: 'B',
        expr: 'rate(http_requests_total[5m])',
        legendFormat: '{{method}}',
        datasource: {
          type: 'prometheus',
          uid: 'new-prometheus',
        },
      } as DataQuery;

      const result = await updateAnnotationFromSavedQuery(v2Annotation, replacedQuery);

      expect(result).toEqual({
        name: 'v2 annotation',
        enable: true,
        iconColor: 'blue',
        hide: false,
        mappings: undefined,
        builtIn: undefined,
        filter: undefined,
        type: undefined,
        datasource: {
          type: 'prometheus',
          uid: 'new-prometheus',
        },
        // v2 annotations maintain both target and query.spec with the new query data
        target: {
          refId: 'Anno', // refId should always be 'Anno' for annotations
          expr: 'rate(http_requests_total[5m])',
          legendFormat: '{{method}}',
          interval: '',
          instant: false, // Normalized for annotation context
          range: true, // Normalized for annotation context
        },
        query: {
          kind: 'prometheus',
          spec: {
            refId: 'Anno', // refId should always be 'Anno' for annotations
            expr: 'rate(http_requests_total[5m])',
            legendFormat: '{{method}}',
            interval: '',
            instant: false, // Normalized for annotation context
            range: true, // Normalized for annotation context
          },
        },
      });
    });

    it('should preserve all annotation-specific fields and clean old query data', async () => {
      const annotationWithManyFields: AnnotationQuery = {
        name: 'complex annotation',
        target: { refId: 'OldRef', expr: 'old_expr' },
        datasource: { type: 'prometheus', uid: 'old-uid' },
        enable: false,
        iconColor: 'yellow',
        hide: true,
        mappings: { title: { value: 'test' } },
        filter: { exclude: false, list: ['tag1'] },
        type: 'dashboard',
        builtIn: 1,
        // These should be cleaned out
        oldQueryField: 'should be removed',
        anotherOldField: 'also removed',
      } as unknown as AnnotationQuery;

      const replacedQuery = {
        refId: 'NewRef',
        expr: 'new_expr',
        datasource: { type: 'loki', uid: 'new-loki-uid' },
      } as DataQuery;

      const result = await updateAnnotationFromSavedQuery(annotationWithManyFields, replacedQuery);

      expect(result).toEqual({
        name: 'complex annotation',
        enable: false,
        hide: true,
        iconColor: 'yellow',
        mappings: { title: { value: 'test' } },
        filter: { exclude: false, list: ['tag1'] },
        type: 'dashboard',
        builtIn: 1,
        datasource: { type: 'loki', uid: 'new-loki-uid' },
        target: {
          refId: 'Anno', // refId should always be 'Anno' for annotations
          expr: 'new_expr',
          interval: '',
          instant: false, // Normalized for annotation context
          range: true, // Normalized for annotation context
        },
      });

      // Ensure old query fields are not present
      expect(result).not.toHaveProperty('oldQueryField');
      expect(result).not.toHaveProperty('anotherOldField');
    });

    it('should handle cross-datasource replacement', async () => {
      const prometheusAnnotation: AnnotationQuery = {
        name: 'prometheus annotation',
        target: {
          refId: 'A',
          expr: 'prometheus_query',
        } as PromQuery,
        datasource: {
          type: 'prometheus',
          uid: 'prometheus-uid',
        },
        enable: true,
        iconColor: 'red',
      };

      const lokiQuery = {
        refId: 'B',
        expr: '{job="test"}',
        datasource: {
          type: 'loki',
          uid: 'loki-uid',
        },
      } as DataQuery;

      const result = await updateAnnotationFromSavedQuery(prometheusAnnotation, lokiQuery);

      expect(result.datasource).toEqual({
        type: 'loki',
        uid: 'loki-uid',
      });
      expect(result.target).toEqual({
        refId: 'Anno', // refId should always be 'Anno' for annotations
        expr: '{job="test"}',
        interval: '',
        instant: false, // Normalized for annotation context
        range: true, // Normalized for annotation context
      });
      expect(result.name).toBe('prometheus annotation');
      expect(result.iconColor).toBe('red');
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalAnnotation: AnnotationQuery = {
        name: 'minimal annotation',
        enable: true,
        iconColor: 'red',
      };

      const replacedQuery = {
        refId: 'A',
        expr: 'up',
        datasource: {
          type: 'prometheus',
          uid: 'prometheus-uid',
        },
      } as DataQuery;

      const result = await updateAnnotationFromSavedQuery(minimalAnnotation, replacedQuery);

      expect(result).toEqual({
        name: 'minimal annotation',
        enable: true,
        hide: undefined,
        iconColor: 'red',
        mappings: undefined,
        filter: undefined,
        type: undefined,
        builtIn: undefined,
        datasource: {
          type: 'prometheus',
          uid: 'prometheus-uid',
        },
        target: {
          refId: 'Anno', // refId should always be 'Anno' for annotations
          expr: 'up',
          interval: '',
          instant: false, // Normalized for annotation context
          range: true, // Normalized for annotation context
        },
      });
    });
  });
});
