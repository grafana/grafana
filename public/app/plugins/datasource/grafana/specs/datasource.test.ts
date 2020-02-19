import { DataSourceInstanceSettings, dateTime } from '@grafana/data';

import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import templateSrv from 'app/features/templating/template_srv';
import { GrafanaDatasource } from '../datasource';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

describe('grafana data source', () => {
  const getMock = jest.spyOn(backendSrv, 'get');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when executing an annotations query', () => {
    let calledBackendSrvParams: any;
    let ds: GrafanaDatasource;
    beforeEach(() => {
      getMock.mockImplementation((url: string, options: any) => {
        calledBackendSrvParams = options;
        return Promise.resolve([]);
      });

      templateSrv.init([
        { type: 'query', name: 'var', current: { value: 'replaced' } },
        { type: 'query', name: 'var2', current: { value: ['replaced', 'replaced2'] } },
        { type: 'query', name: 'var3', current: { value: ['replaced3', 'replaced4'] } },
        { type: 'query', name: 'var4', current: { value: ['replaced?', 'replaced?2'] } },
        { type: 'query', name: 'var5', current: { value: ['replaced?3', 'replaced?4'] } },
      ]);

      ds = new GrafanaDatasource({} as DataSourceInstanceSettings);
    });

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
      const options = setupAnnotationQueryOptions({ tags: ['$var2', '$var3'] });

      beforeEach(() => {
        return ds.annotationQuery(options);
      });

      it('should interpolate template variables in tags in query options', () => {
        expect(calledBackendSrvParams.tags[0]).toBe('replaced');
        expect(calledBackendSrvParams.tags[1]).toBe('replaced2');
        expect(calledBackendSrvParams.tags[2]).toBe('replaced3');
        expect(calledBackendSrvParams.tags[3]).toBe('replaced4');
      });
    });

    describe('with key-value tags that have one variable having mutiple values', () => {
      const options = setupAnnotationQueryOptions({ tags: ['tag1:${var2}'] });

      beforeEach(() => {
        return ds.annotationQuery(options);
      });

      it('should interpolate template variables in tags in query options', () => {
        expect(calledBackendSrvParams.tags[0]).toBe('tag1:replaced');
        expect(calledBackendSrvParams.tags[1]).toBe('tag1:replaced2');
      });
    });

    describe('with key-value tags that have multiple template variables having mutiple values', () => {
      const options = setupAnnotationQueryOptions({ tags: ['tag1:$var2-$var3-trailing'] });

      beforeEach(() => {
        return ds.annotationQuery(options);
      });

      it('should interpolate template variables in tags in query options', () => {
        expect(calledBackendSrvParams.tags[0]).toBe('tag1:replaced-replaced3-trailing');
        expect(calledBackendSrvParams.tags[1]).toBe('tag1:replaced-replaced4-trailing');
        expect(calledBackendSrvParams.tags[2]).toBe('tag1:replaced2-replaced3-trailing');
        expect(calledBackendSrvParams.tags[3]).toBe('tag1:replaced2-replaced4-trailing');
      });
    });

    describe('with key-value tags including one having specific format', () => {
      const options = setupAnnotationQueryOptions({ tags: ['tag1:$var4-${var5:percentencode}-trailing'] });

      beforeEach(() => {
        return ds.annotationQuery(options);
      });

      it('should interpolate template variables in tags in query options', () => {
        expect(calledBackendSrvParams.tags[0]).toBe('tag1:replaced?-replaced%3F3-trailing');
        expect(calledBackendSrvParams.tags[1]).toBe('tag1:replaced?-replaced%3F4-trailing');
        expect(calledBackendSrvParams.tags[2]).toBe('tag1:replaced?2-replaced%3F3-trailing');
        expect(calledBackendSrvParams.tags[3]).toBe('tag1:replaced?2-replaced%3F4-trailing');
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
