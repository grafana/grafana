import { GrafanaDatasource } from '../datasource';
import q from 'q';
import moment from 'moment';

describe('grafana data source', () => {
  describe('when executing an annotations query', () => {
    let calledBackendSrvParams;
    const backendSrvStub = {
      get: (url, options) => {
        calledBackendSrvParams = options;
        return q.resolve([]);
      },
    };

    const templateSrvStub = {
      replace: val => {
        return val.replace('$var2', 'replaced__delimiter__replaced2').replace('$var', 'replaced');
      },
    };

    const ds = new GrafanaDatasource(backendSrvStub, q, templateSrvStub);

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

function setupAnnotationQueryOptions(annotation, dashboard?) {
  return {
    annotation: annotation,
    dashboard: dashboard,
    range: {
      from: moment(1432288354),
      to: moment(1432288401),
    },
    rangeRaw: { from: 'now-24h', to: 'now' },
  };
}
