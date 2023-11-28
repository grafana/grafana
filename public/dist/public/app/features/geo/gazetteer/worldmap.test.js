import { __awaiter } from "tslib";
import { toLonLat } from 'ol/proj';
import countriesJSON from '../../../../gazetteer/countries.json';
import { getGazetteer } from './gazetteer';
let backendResults = { hello: 'world' };
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => ({
        get: jest.fn().mockResolvedValue(backendResults),
    }) })));
describe('Placename lookup from worldmap format', () => {
    beforeEach(() => {
        backendResults = { hello: 'world' };
    });
    it('unified worldmap config', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        backendResults = countriesJSON;
        const gaz = yield getGazetteer('countries');
        expect(gaz.error).toBeUndefined();
        expect(toLonLat((_b = (_a = gaz.find('US')) === null || _a === void 0 ? void 0 : _a.point()) === null || _b === void 0 ? void 0 : _b.getCoordinates())).toMatchInlineSnapshot(`
      [
        -95.712891,
        37.09023999999998,
      ]
    `);
        // Items with 'keys' should get allow looking them up
        expect(gaz.find('US')).toEqual(gaz.find('USA'));
    }));
});
//# sourceMappingURL=worldmap.test.js.map