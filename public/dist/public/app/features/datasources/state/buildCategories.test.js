import { __assign } from "tslib";
import { buildCategories } from './buildCategories';
import { getMockPlugin } from '../../plugins/__mocks__/pluginMocks';
var plugins = [
    __assign(__assign({}, getMockPlugin({ id: 'graphite' })), { category: 'tsdb' }),
    __assign(__assign({}, getMockPlugin({ id: 'prometheus' })), { category: 'tsdb' }),
    __assign(__assign({}, getMockPlugin({ id: 'elasticsearch' })), { category: 'logging' }),
    __assign(__assign({}, getMockPlugin({ id: 'loki' })), { category: 'logging' }),
    __assign(__assign({}, getMockPlugin({ id: 'azure' })), { category: 'cloud' }),
];
describe('buildCategories', function () {
    var categories = buildCategories(plugins);
    it('should group plugins into categories and remove empty categories', function () {
        expect(categories.length).toBe(4);
        expect(categories[0].title).toBe('Time series databases');
        expect(categories[0].plugins.length).toBe(2);
        expect(categories[1].title).toBe('Logging & document databases');
    });
    it('should sort plugins according to hard coded sorting rules', function () {
        expect(categories[1].plugins[0].id).toBe('loki');
    });
    it('should add phantom plugin for Grafana cloud', function () {
        expect(categories[2].title).toBe('Cloud');
        expect(categories[2].plugins.length).toBe(2);
        expect(categories[2].plugins[1].id).toBe('gcloud');
    });
    it('should set module to phantom on phantom plugins', function () {
        expect(categories[3].plugins[0].module).toBe('phantom');
    });
    it('should add enterprise phantom plugins', function () {
        expect(categories[3].title).toBe('Enterprise plugins');
        expect(categories[3].plugins.length).toBe(16);
    });
});
//# sourceMappingURL=buildCategories.test.js.map