import { fromString } from '../../graphite/configuration/parseLokiLabelMappings';
import fromGraphiteQueries from './fromGraphite';
describe('importing from Graphite queries', function () {
    var graphiteDatasourceMock;
    function mockSettings(stringMappings) {
        graphiteDatasourceMock = {
            getImportQueryConfiguration: function () { return ({
                loki: {
                    mappings: stringMappings.map(fromString),
                },
            }); },
            createFuncInstance: function (name) { return ({
                name: name,
                params: [],
                def: {
                    name: name,
                    params: [{ multiple: true }],
                },
                updateText: function () { },
            }); },
        };
    }
    function mockGraphiteQuery(raw) {
        return {
            refId: 'A',
            target: raw,
        };
    }
    beforeEach(function () { });
    it('test matching mappings', function () {
        mockSettings(['servers.(cluster).(server).*']);
        var lokiQueries = fromGraphiteQueries([
            // metrics: captured
            mockGraphiteQuery('interpolate(alias(servers.west.001.cpu,1,2))'),
            mockGraphiteQuery('interpolate(alias(servers.east.001.request.POST.200,1,2))'),
            mockGraphiteQuery('interpolate(alias(servers.*.002.*,1,2))'),
            // tags: captured
            mockGraphiteQuery("interpolate(seriesByTag('cluster=west', 'server=002'), inf))"),
            mockGraphiteQuery("interpolate(seriesByTag('foo=bar', 'server=002'), inf))"),
            // regexp
            mockGraphiteQuery('interpolate(alias(servers.eas*.{001,002}.request.POST.200,1,2))'),
            // not captured
            mockGraphiteQuery('interpolate(alias(test.west.001.cpu))'),
            mockGraphiteQuery('interpolate(alias(servers.west.001))'),
        ], graphiteDatasourceMock);
        expect(lokiQueries).toMatchObject([
            { refId: 'A', expr: '{cluster="west", server="001"}' },
            { refId: 'A', expr: '{cluster="east", server="001"}' },
            { refId: 'A', expr: '{server="002"}' },
            { refId: 'A', expr: '{cluster="west", server="002"}' },
            { refId: 'A', expr: '{foo="bar", server="002"}' },
            { refId: 'A', expr: '{cluster=~"^eas.*", server=~"^(001|002)"}' },
            { refId: 'A', expr: '' },
            { refId: 'A', expr: '' },
        ]);
    });
});
//# sourceMappingURL=importing.test.js.map