import { AnnotationsSrv } from '../annotations_srv';
import { AnnotationEvent, dateTime, DataQueryResponse, AnnotationQueryRequest } from '@grafana/data';
import { DatasourceSrvMock, MockDataSourceApi } from 'test/mocks/datasource_srv';
import templateSrv from '../../templating/template_srv';
import { CustomVariable } from 'app/features/templating/custom_variable';

jest.mock('app/core/config', () => {
  return {
    getConfig: () => ({ featureToggles: {} }),
  };
});

jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  __esModule: true,
  getTimeSrv: jest.fn().mockReturnValue({
    timeRange(): any {
      return {
        from: dateTime('2018-01-29'),
        to: dateTime('2019-01-29'),
      };
    },
  }),
}));

let annotations: AnnotationEvent[] = [];

class AnnotationMockDataSourceApi extends MockDataSourceApi {
  constructor(name?: string, result?: DataQueryResponse) {
    super(name, result);
  }

  annotationQuery(options: AnnotationQueryRequest): Promise<AnnotationEvent[]> {
    return Promise.resolve(annotations);
  }
}

const defaultDS = new MockDataSourceApi('DefaultDS', { data: ['DDD'] });
const datasourceSrv = new DatasourceSrvMock(defaultDS, {
  '-- Grafana --': new AnnotationMockDataSourceApi('DSA', { data: ['AAAA'] }),
});

jest.mock('@grafana/runtime', () => ({
  getDataSourceSrv: () => {
    return datasourceSrv;
  },
  setTemplateSrv: () => {},
  DataSourceWithBackend: jest.fn(),
}));

jest.mock('app/core/core', () => ({
  coreModule: {
    directive: () => {},
  },
  appEvents: {
    emit: (event: any, payload?: any) => {},
  },
}));

describe('AnnotationsSrv', function(this: any) {
  beforeEach(() => {
    templateSrv.init([
      new CustomVariable(
        {
          name: 'var',
          current: { value: ['3', '4'] },
          multi: true,
        },
        {} as any
      ),
    ]);
  });

  describe('When translating the query result', () => {
    const time = 1507039543000;
    const annotations = [{ id: 1, panelId: 1, text: 'text', time: time }];
    const annotationSource = {
      datasource: '-- Grafana --',
      enable: true,
      hide: false,
      limit: 200,
      name: 'test',
      scope: 'global',
      tags: ['test'],
      type: 'event',
    };
    let translatedAnnotations: any;

    beforeEach(() => {
      const annotationsSrv = new AnnotationsSrv();
      translatedAnnotations = annotationsSrv.translateQueryResult(annotationSource, annotations);
    });

    it('should set defaults', () => {
      expect(translatedAnnotations[0].source).toEqual(annotationSource);
    });
  });

  describe('When getting annotations', () => {
    const time = 1507039543000;
    const annotation1 = { id: '1', panelId: 1, text: 'text', time: time };
    const annotation2 = { id: '2', panelId: 2, text: 'text2', time: time, tags: ['foo', 'bar:2'] };
    const annotation3 = { id: '3', panelId: 2, text: 'text3', time: time, tags: ['foo', 'bar:3'] };
    annotations = [annotation1, annotation2, annotation3];
    let options: any;
    let annotationsSrv: any;
    beforeEach(() => {
      const annotationSource = {
        datasource: '-- Grafana --',
        enable: true,
        hide: false,
        limit: 200,
        name: 'test',
        scope: 'global',
        tags: ['test'],
        type: 'event',
      };
      options = {
        panel: { id: 1, options: {}, getSavedId: () => 1 },
        dashboard: { annotations: { list: [annotationSource] } },
      };
      annotationsSrv = new AnnotationsSrv();
    });
    it('should get annotations with panelId filter', async () => {
      options.dashboard.annotations.list[0].type = 'dashboard';
      expect(await annotationsSrv.getAnnotations(options)).toEqual({
        alertState: undefined,
        annotations: [annotation1],
      });
    });
    it('should filter annotations with both panelId and tag filters ', async () => {
      options.dashboard.annotations.list[0].type = 'dashboard';
      options.panel.options.annotation = { tags: ['foo'] };
      expect(await annotationsSrv.getAnnotations(options)).toEqual({ alertState: undefined, annotations: [] });
    });
    it('should get all annotations without annotation option', async () => {
      expect(await annotationsSrv.getAnnotations(options)).toEqual({ alertState: undefined, annotations: annotations });
    });
    it('should get all annotations with empty annotation option', async () => {
      options.panel.options.annotation = {};
      expect(await annotationsSrv.getAnnotations(options)).toEqual({ alertState: undefined, annotations: annotations });
    });
    it('should get all annotations with empty annotation tags option', async () => {
      options.panel.options.annotation = { tags: [] };
      expect(await annotationsSrv.getAnnotations(options)).toEqual({ alertState: undefined, annotations: annotations });
    });
    it('should get annotations with all tag matching without matchAny option', async () => {
      options.panel.options.annotation = { tags: ['other', 'foo'] };
      expect(await annotationsSrv.getAnnotations(options)).toEqual({ alertState: undefined, annotations: [] });
    });
    it('should get annotations with any tag matching using matchAny option', async () => {
      options.panel.options.annotation = { tags: ['other', 'bar:.*'], matchAny: true };
      expect(await annotationsSrv.getAnnotations(options)).toEqual({
        alertState: undefined,
        annotations: [annotation2, annotation3],
      });
    });
    it('should get no annotations with not all tag matching', async () => {
      options.panel.options.annotation = { tags: ['other', 'bar:.*'], matchAny: false };
      expect(await annotationsSrv.getAnnotations(options)).toEqual({ alertState: undefined, annotations: [] });
    });
    it('should get annotations with all tag matching', async () => {
      options.panel.options.annotation = { tags: ['foo', 'bar:.*'], matchAny: false };
      expect(await annotationsSrv.getAnnotations(options)).toEqual({
        alertState: undefined,
        annotations: [annotation2, annotation3],
      });
    });
    it('should get annotations with alternative regexp', async () => {
      options.panel.options.annotation = { tags: ['foo', '(other|bar:.*)'], matchAny: false };
      expect(await annotationsSrv.getAnnotations(options)).toEqual({
        alertState: undefined,
        annotations: [annotation2, annotation3],
      });
    });
    it('should get annotations with template variable', async () => {
      options.panel.options.annotation = { tags: ['foo', '(other|bar:$var)'], matchAny: false };
      expect(await annotationsSrv.getAnnotations(options)).toEqual({
        alertState: undefined,
        annotations: [annotation3],
      });
    });
    it('should get annotations with scoped vars', async () => {
      options.panel.options.annotation = { tags: ['foo', '(other|bar:$server)'], matchAny: false };
      options.panel.scopedVars = { server: { text: 'Server3', value: '3' } };
      expect(await annotationsSrv.getAnnotations(options)).toEqual({
        alertState: undefined,
        annotations: [annotation3],
      });
    });
  });
});
