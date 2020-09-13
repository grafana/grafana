import { AnnotationsSrv } from '../annotations_srv';

describe('AnnotationsSrv', () => {
  const annotationsSrv = new AnnotationsSrv();

  describe('When translating the query result', () => {
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

    const time = 1507039543000;
    const annotations = [{ id: 1, panelId: 1, text: 'text', time: time }];
    let translatedAnnotations: any;

    beforeEach(() => {
      translatedAnnotations = annotationsSrv.translateQueryResult(annotationSource, annotations);
    });

    it('should set defaults', () => {
      expect(translatedAnnotations[0].source).toEqual(annotationSource);
    });
  });
});
