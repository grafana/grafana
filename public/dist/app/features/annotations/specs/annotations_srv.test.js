import { AnnotationsSrv } from '../annotations_srv';
describe('AnnotationsSrv', function () {
    var $rootScope = {
        onAppEvent: jest.fn(),
    };
    var annotationsSrv = new AnnotationsSrv($rootScope, null, null, null, null);
    describe('When translating the query result', function () {
        var annotationSource = {
            datasource: '-- Grafana --',
            enable: true,
            hide: false,
            limit: 200,
            name: 'test',
            scope: 'global',
            tags: ['test'],
            type: 'event',
        };
        var time = 1507039543000;
        var annotations = [{ id: 1, panelId: 1, text: 'text', time: time }];
        var translatedAnnotations;
        beforeEach(function () {
            translatedAnnotations = annotationsSrv.translateQueryResult(annotationSource, annotations);
        });
        it('should set defaults', function () {
            expect(translatedAnnotations[0].source).toEqual(annotationSource);
        });
    });
});
//# sourceMappingURL=annotations_srv.test.js.map