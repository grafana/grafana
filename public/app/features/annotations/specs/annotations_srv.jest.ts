//import { describe, beforeEach, it, expect, angularMocks } from 'test/lib/common';
import '../annotations_srv';
import helpers from 'test/specs/helpers';
import 'app/features/dashboard/time_srv';
import { AnnotationsSrv } from '../annotations_srv';

describe('AnnotationsSrv', function() {
  let $rootScope = {
    onAppEvent: jest.fn(),
  };
  let $q;
  let datasourceSrv;
  let backendSrv;
  let timeSrv;

  let annotationsSrv = new AnnotationsSrv($rootScope, $q, datasourceSrv, backendSrv, timeSrv);

  // beforeEach(angularMocks.module('grafana.core'));
  // beforeEach(angularMocks.module('grafana.services'));
  // beforeEach(ctx.createService('timeSrv'));
  // beforeEach(() => {
  //   ctx.createService('annotationsSrv');
  // });

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
      translatedAnnotations = annotationsSrv.translateQueryResult(annotationSource, annotations);
    });

    it('should set defaults', () => {
      expect(translatedAnnotations[0].source).toEqual(annotationSource);
    });
  });
});
