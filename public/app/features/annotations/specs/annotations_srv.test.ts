import { AnnotationsSrv } from '../annotations_srv';
// @ts-ignore
import $q from 'q';
import { AnnotationEvent } from '@grafana/data';

describe('AnnotationsSrv', function(this: any) {
  const ctx = {
    $rootScope: {
      onAppEvent: jest.fn(),
    },
    datasourceSrv: {},
    timeSrv: {
      timeRange: () => {
        return { from: '2018-01-29', to: '2019-01-29' };
      },
    },
    templateSrv: {
      updateIndex: () => {},
      replace: (val: string) => val.replace('$var', '(3|4)'),
    },
  } as any;

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
      const annotationsSrv = new AnnotationsSrv(ctx.$rootScope, null, null, null, null, null);
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
    const annotations: AnnotationEvent[] = [annotation1, annotation2, annotation3];
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
        panel: { id: 1 },
        dashboard: { annotations: { list: [annotationSource] } },
      };
      const ds: any = {};
      ds.annotationQuery = () => Promise.resolve(annotations);

      ctx.datasourceSrv = {
        get: () => Promise.resolve(ds),
      };
      annotationsSrv = new AnnotationsSrv(
        ctx.$rootScope,
        $q,
        ctx.datasourceSrv,
        ctx.backendSrv,
        ctx.timeSrv,
        ctx.templateSrv
      );
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
      options.panel.annotation = { tags: ['foo'] };
      expect(await annotationsSrv.getAnnotations(options)).toEqual({ alertState: undefined, annotations: [] });
    });
    it('should get all annotations without annotation option', async () => {
      expect(await annotationsSrv.getAnnotations(options)).toEqual({ alertState: undefined, annotations: annotations });
    });
    it('should get all annotations with empty annotation option', async () => {
      options.panel.annotation = {};
      expect(await annotationsSrv.getAnnotations(options)).toEqual({ alertState: undefined, annotations: annotations });
    });
    it('should get all annotations with empty annotation tags option', async () => {
      options.panel.annotation = { tags: [] };
      expect(await annotationsSrv.getAnnotations(options)).toEqual({ alertState: undefined, annotations: annotations });
    });
    it('should get annotations with all tag matching without matchAny option', async () => {
      options.panel.annotation = { tags: ['other', 'foo'] };
      expect(await annotationsSrv.getAnnotations(options)).toEqual({ alertState: undefined, annotations: [] });
    });
    it('should get annotations with any tag matching using matchAny option', async () => {
      options.panel.annotation = { tags: ['other', 'bar:.*'], matchAny: true };
      expect(await annotationsSrv.getAnnotations(options)).toEqual({
        alertState: undefined,
        annotations: [annotation2, annotation3],
      });
    });
    it('should get no annotations with not all tag matching', async () => {
      options.panel.annotation = { tags: ['other', 'bar:.*'], matchAny: false };
      expect(await annotationsSrv.getAnnotations(options)).toEqual({ alertState: undefined, annotations: [] });
    });
    it('should get annotations with all tag matching', async () => {
      options.panel.annotation = { tags: ['foo', 'bar:.*'], matchAny: false };
      expect(await annotationsSrv.getAnnotations(options)).toEqual({
        alertState: undefined,
        annotations: [annotation2, annotation3],
      });
    });
    it('should get annotations with alternative regexp', async () => {
      options.panel.annotation = { tags: ['foo', '(other|bar:.*)'], matchAny: false };
      expect(await annotationsSrv.getAnnotations(options)).toEqual({
        alertState: undefined,
        annotations: [annotation2, annotation3],
      });
    });
    it('should get annotations with template variable', async () => {
      options.panel.annotation = { tags: ['foo', '(other|bar:$var)'], matchAny: false };
      expect(await annotationsSrv.getAnnotations(options)).toEqual({
        alertState: undefined,
        annotations: [annotation3],
      });
    });
  });
});
