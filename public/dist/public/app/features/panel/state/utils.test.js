import { __awaiter } from "tslib";
import { escapeStringForRegex } from '@grafana/data';
import { filterPluginList } from './util';
describe('panel state utils', () => {
    it('should include timeseries in a graph query', () => __awaiter(void 0, void 0, void 0, function* () {
        const pluginsList = [
            { id: 'graph', name: 'Graph (old)' },
            { id: 'timeseries', name: 'Graph (old)' },
            { id: 'timeline', name: 'Timeline' },
        ];
        const found = filterPluginList(pluginsList, escapeStringForRegex('gra'), { id: 'xyz' });
        expect(found.map((v) => v.id)).toEqual(['graph', 'timeseries']);
    }));
    it('should handle escaped regex characters in the search query (e.g. -)', () => __awaiter(void 0, void 0, void 0, function* () {
        const pluginsList = [
            { id: 'graph', name: 'Graph (old)' },
            { id: 'timeseries', name: 'Graph (old)' },
            { id: 'timeline', name: 'Timeline' },
            { id: 'panelwithdashes', name: 'Panel-With-Dashes' },
        ];
        const found = filterPluginList(pluginsList, escapeStringForRegex('panel-'), { id: 'xyz' });
        expect(found.map((v) => v.id)).toEqual(['panelwithdashes']);
    }));
});
//# sourceMappingURL=utils.test.js.map