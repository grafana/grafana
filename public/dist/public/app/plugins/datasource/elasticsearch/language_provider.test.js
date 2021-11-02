import { __assign, __awaiter, __generator } from "tslib";
import LanguageProvider from './language_provider';
import { ElasticDatasource } from './datasource';
var templateSrvStub = {
    getAdhocFilters: jest.fn(function () { return []; }),
    replace: jest.fn(function (a) { return a; }),
};
var dataSource = new ElasticDatasource({
    url: 'http://es.com',
    database: '[asd-]YYYY.MM.DD',
    jsonData: {
        interval: 'Daily',
        esVersion: '2.0.0',
        timeField: '@time',
    },
}, templateSrvStub);
var baseLogsQuery = {
    metrics: [{ type: 'logs', id: '1' }],
};
describe('transform prometheus query to elasticsearch query', function () {
    it('With exact equals labels ( 2 labels ) and metric __name__', function () {
        var instance = new LanguageProvider(dataSource);
        var promQuery = { refId: 'bar', expr: 'my_metric{label1="value1",label2="value2"}' };
        var result = instance.importQueries([promQuery], 'prometheus');
        expect(result).toEqual([
            __assign(__assign({}, baseLogsQuery), { query: '__name__:"my_metric" AND label1:"value1" AND label2:"value2"', refId: promQuery.refId }),
        ]);
    });
    it('With exact equals labels ( 1 labels ) and metric __name__', function () {
        var instance = new LanguageProvider(dataSource);
        var promQuery = { refId: 'bar', expr: 'my_metric{label1="value1"}' };
        var result = instance.importQueries([promQuery], 'prometheus');
        expect(result).toEqual([
            __assign(__assign({}, baseLogsQuery), { query: '__name__:"my_metric" AND label1:"value1"', refId: promQuery.refId }),
        ]);
    });
    it('With exact equals labels ( 1 labels )', function () {
        var instance = new LanguageProvider(dataSource);
        var promQuery = { refId: 'bar', expr: '{label1="value1"}' };
        var result = instance.importQueries([promQuery], 'prometheus');
        expect(result).toEqual([
            __assign(__assign({}, baseLogsQuery), { query: 'label1:"value1"', refId: promQuery.refId }),
        ]);
    });
    it('With no label and metric __name__', function () {
        var instance = new LanguageProvider(dataSource);
        var promQuery = { refId: 'bar', expr: 'my_metric{}' };
        var result = instance.importQueries([promQuery], 'prometheus');
        expect(result).toEqual([
            __assign(__assign({}, baseLogsQuery), { query: '__name__:"my_metric"', refId: promQuery.refId }),
        ]);
    });
    it('With no label and metric __name__ without bracket', function () {
        var instance = new LanguageProvider(dataSource);
        var promQuery = { refId: 'bar', expr: 'my_metric' };
        var result = instance.importQueries([promQuery], 'prometheus');
        expect(result).toEqual([
            __assign(__assign({}, baseLogsQuery), { query: '__name__:"my_metric"', refId: promQuery.refId }),
        ]);
    });
    it('With rate function and exact equals labels ( 2 labels ) and metric __name__', function () {
        var instance = new LanguageProvider(dataSource);
        var promQuery = { refId: 'bar', expr: 'rate(my_metric{label1="value1",label2="value2"}[5m])' };
        var result = instance.importQueries([promQuery], 'prometheus');
        expect(result).toEqual([
            __assign(__assign({}, baseLogsQuery), { query: '__name__:"my_metric" AND label1:"value1" AND label2:"value2"', refId: promQuery.refId }),
        ]);
    });
    it('With rate function and exact equals labels not equals labels regex and not regex labels and metric __name__', function () {
        var instance = new LanguageProvider(dataSource);
        var promQuery = {
            refId: 'bar',
            expr: 'rate(my_metric{label1="value1",label2!="value2",label3=~"value.+",label4!~".*tothemoon"}[5m])',
        };
        var result = instance.importQueries([promQuery], 'prometheus');
        expect(result).toEqual([
            __assign(__assign({}, baseLogsQuery), { query: '__name__:"my_metric" AND label1:"value1" AND NOT label2:"value2" AND label3:/value.+/ AND NOT label4:/.*tothemoon/', refId: promQuery.refId }),
        ]);
    });
});
describe('transform malformed prometheus query to elasticsearch query', function () {
    it('With only bracket', function () {
        var instance = new LanguageProvider(dataSource);
        var promQuery = { refId: 'bar', expr: '{' };
        var result = instance.importQueries([promQuery], 'prometheus');
        expect(result).toEqual([
            __assign(__assign({}, baseLogsQuery), { query: '', refId: promQuery.refId }),
        ]);
    });
    it('Empty query', function () { return __awaiter(void 0, void 0, void 0, function () {
        var instance, promQuery, result;
        return __generator(this, function (_a) {
            instance = new LanguageProvider(dataSource);
            promQuery = { refId: 'bar', expr: '' };
            result = instance.importQueries([promQuery], 'prometheus');
            expect(result).toEqual([
                __assign(__assign({}, baseLogsQuery), { query: '', refId: promQuery.refId }),
            ]);
            return [2 /*return*/];
        });
    }); });
});
describe('Unsupportated datasources', function () {
    it('Generates a default query', function () { return __awaiter(void 0, void 0, void 0, function () {
        var instance, someQuery, result;
        return __generator(this, function (_a) {
            instance = new LanguageProvider(dataSource);
            someQuery = { refId: 'bar' };
            result = instance.importQueries([someQuery], 'THIS DATASOURCE TYPE DOESNT EXIST');
            expect(result).toEqual([{ refId: someQuery.refId }]);
            return [2 /*return*/];
        });
    }); });
});
//# sourceMappingURL=language_provider.test.js.map