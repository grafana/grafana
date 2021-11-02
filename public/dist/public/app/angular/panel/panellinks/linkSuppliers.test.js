import { getFieldLinksSupplier } from './linkSuppliers';
import { applyFieldOverrides, createTheme, DataFrameView, dateTime, toDataFrame } from '@grafana/data';
import { getLinkSrv, LinkSrv, setLinkSrv } from './link_srv';
import { TemplateSrv } from '../../../features/templating/template_srv';
// We do not need more here and TimeSrv is hard to setup fully.
jest.mock('app/features/dashboard/services/TimeSrv', function () { return ({
    getTimeSrv: function () { return ({
        timeRangeForUrl: function () {
            var from = dateTime().subtract(1, 'h');
            var to = dateTime();
            return { from: from, to: to, raw: { from: from, to: to } };
        },
    }); },
}); });
describe('getFieldLinksSupplier', function () {
    var originalLinkSrv;
    var templateSrv = new TemplateSrv();
    beforeAll(function () {
        var linkService = new LinkSrv();
        originalLinkSrv = getLinkSrv();
        setLinkSrv(linkService);
    });
    afterAll(function () {
        setLinkSrv(originalLinkSrv);
    });
    it('links to items on the row', function () {
        var data = applyFieldOverrides({
            data: [
                toDataFrame({
                    name: 'Hello Templates',
                    refId: 'ZZZ',
                    fields: [
                        { name: 'Time', values: [1, 2, 3] },
                        {
                            name: 'Power',
                            values: [100.2000001, 200, 300],
                            config: {
                                unit: 'kW',
                                decimals: 3,
                                displayName: 'TheTitle',
                            },
                        },
                        {
                            name: 'Last',
                            values: ['a', 'b', 'c'],
                            config: {
                                links: [
                                    {
                                        title: 'By Name',
                                        url: 'http://go/${__data.fields.Power}',
                                    },
                                    {
                                        title: 'By Index',
                                        url: 'http://go/${__data.fields[1]}',
                                    },
                                    {
                                        title: 'By Title',
                                        url: 'http://go/${__data.fields[TheTitle]}',
                                    },
                                    {
                                        title: 'Numeric Value',
                                        url: 'http://go/${__data.fields.Power.numeric}',
                                    },
                                    {
                                        title: 'Text (no suffix)',
                                        url: 'http://go/${__data.fields.Power.text}',
                                    },
                                    {
                                        title: 'Unknown Field',
                                        url: 'http://go/${__data.fields.XYZ}',
                                    },
                                    {
                                        title: 'Data Frame name',
                                        url: 'http://go/${__data.name}',
                                    },
                                    {
                                        title: 'Data Frame refId',
                                        url: 'http://go/${__data.refId}',
                                    },
                                ],
                            },
                        },
                    ],
                }),
            ],
            fieldConfig: {
                defaults: {},
                overrides: [],
            },
            replaceVariables: function (val) { return val; },
            timeZone: 'utc',
            theme: createTheme(),
        })[0];
        var rowIndex = 0;
        var colIndex = data.fields.length - 1;
        var field = data.fields[colIndex];
        var fieldDisp = {
            name: 'hello',
            field: field.config,
            view: new DataFrameView(data),
            rowIndex: rowIndex,
            colIndex: colIndex,
            display: field.display(field.values.get(rowIndex)),
            hasLinks: true,
        };
        var supplier = getFieldLinksSupplier(fieldDisp);
        var links = supplier === null || supplier === void 0 ? void 0 : supplier.getLinks(templateSrv.replace.bind(templateSrv)).map(function (m) {
            return {
                title: m.title,
                href: m.href,
            };
        });
        expect(links).toMatchInlineSnapshot("\n      Array [\n        Object {\n          \"href\": \"http://go/100.200 kW\",\n          \"title\": \"By Name\",\n        },\n        Object {\n          \"href\": \"http://go/100.200 kW\",\n          \"title\": \"By Index\",\n        },\n        Object {\n          \"href\": \"http://go/100.200 kW\",\n          \"title\": \"By Title\",\n        },\n        Object {\n          \"href\": \"http://go/100.2000001\",\n          \"title\": \"Numeric Value\",\n        },\n        Object {\n          \"href\": \"http://go/100.200\",\n          \"title\": \"Text (no suffix)\",\n        },\n        Object {\n          \"href\": \"http://go/${__data.fields.XYZ}\",\n          \"title\": \"Unknown Field\",\n        },\n        Object {\n          \"href\": \"http://go/Hello Templates\",\n          \"title\": \"Data Frame name\",\n        },\n        Object {\n          \"href\": \"http://go/ZZZ\",\n          \"title\": \"Data Frame refId\",\n        },\n      ]\n    ");
    });
});
//# sourceMappingURL=linkSuppliers.test.js.map