import { GrafanaDatasource } from '../datasource';
// @ts-ignore
import q from 'q';
import { dateTime } from '@grafana/data';

describe('grafana data source', () => {
  describe('when executing an annotations query', () => {
    let calledBackendSrvParams: any;
    const backendSrvStub = {
      get: (url: string, options: any) => {
        calledBackendSrvParams = options;
        return q.resolve([]);
      },
    };

    const templateSrvStub = {
      replace: (val: string) => {
        return val.replace('$var2', 'replaced__delimiter__replaced2').replace('$var', 'replaced');
      },
    };

    const ds = new GrafanaDatasource(backendSrvStub as any, q, templateSrvStub as any);

    describe('with tags that have template variables', () => {
      const options = setupAnnotationQueryOptions({ tags: ['tag1:$var'] });

      beforeEach(() => {
        return ds.annotationQuery(options);
      });

      it('should interpolate template variables in tags in query options', () => {
        expect(calledBackendSrvParams.tags[0]).toBe('tag1:replaced');
      });
    });

    describe('with tags that have multi value template variables', () => {
      const options = setupAnnotationQueryOptions({ tags: ['$var2'] });

      beforeEach(() => {
        return ds.annotationQuery(options);
      });

      it('should interpolate template variables in tags in query options', () => {
        expect(calledBackendSrvParams.tags[0]).toBe('replaced');
        expect(calledBackendSrvParams.tags[1]).toBe('replaced2');
      });
    });

    describe('with type dashboard', () => {
      const options = setupAnnotationQueryOptions(
        {
          type: 'dashboard',
          tags: ['tag1'],
        },
        { id: 1 }
      );

      beforeEach(() => {
        return ds.annotationQuery(options);
      });

      it('should remove tags from query options', () => {
        expect(calledBackendSrvParams.tags).toBe(undefined);
      });
    });
  });
});

function setupAnnotationQueryOptions(annotation: { tags: string[]; type?: string }, dashboard?: { id: number }) {
  return {
    annotation,
    dashboard,
    range: {
      from: dateTime(1432288354),
      to: dateTime(1432288401),
    },
    rangeRaw: { from: 'now-24h', to: 'now' },
  };
}
