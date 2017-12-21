import { describe, beforeEach, it, expect, angularMocks } from 'test/lib/common';
import '../annotations_srv';
import helpers from 'test/specs/helpers';

describe('AnnotationsSrv', function() {
  var ctx = new helpers.ServiceTestContext();

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(() => {
    ctx.createService('annotationsSrv');
  });
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
    let translatedAnnotations;

    beforeEach(() => {
      translatedAnnotations = ctx.service.translateQueryResult(annotationSource, annotations);
    });

    it('should set defaults', () => {
      expect(translatedAnnotations[0].source).to.eql(annotationSource);
    });
  });
});
