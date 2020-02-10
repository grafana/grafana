import { DataSourceInstanceSettings, dateTime } from '@grafana/data';
import { GrafanaDatasource } from '../datasource';
import * as getRequestWithCancel from '../../../../core/utils/getRequestWithCancel';

jest.mock('app/features/templating/template_srv', () => ({
  replace: (val: string) => {
    return val.replace('$var2', 'replaced__delimiter__replaced2').replace('$var', 'replaced');
  },
}));

describe('grafana data source', () => {
  const getRequestWithCancelMock = jest.spyOn(getRequestWithCancel, 'getRequestWithCancel');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when executing an annotations query', () => {
    let calledBackendSrvParams: any;
    let ds: GrafanaDatasource;
    beforeEach(() => {
      getRequestWithCancelMock.mockImplementation(options => {
        calledBackendSrvParams = options;
        return Promise.resolve([]);
      });

      ds = new GrafanaDatasource({} as DataSourceInstanceSettings);
    });

    describe('with tags that have template variables', () => {
      const options = setupAnnotationQueryOptions({ tags: ['tag1:$var'] });

      beforeEach(() => {
        return ds.annotationQuery(options);
      });

      it('should interpolate template variables in tags in query options', () => {
        expect(calledBackendSrvParams.params.tags[0]).toBe('tag1:replaced');
      });
    });

    describe('with tags that have multi value template variables', () => {
      const options = setupAnnotationQueryOptions({ tags: ['$var2'] });

      beforeEach(() => {
        return ds.annotationQuery(options);
      });

      it('should interpolate template variables in tags in query options', () => {
        expect(calledBackendSrvParams.params.tags[0]).toBe('replaced');
        expect(calledBackendSrvParams.params.tags[1]).toBe('replaced2');
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
        expect(calledBackendSrvParams.params.tags).toBe(undefined);
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
