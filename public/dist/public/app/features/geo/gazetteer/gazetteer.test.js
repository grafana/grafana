import { __awaiter } from "tslib";
import { getCenterPointWGS84 } from 'app/features/transformers/spatial/utils';
import { getGazetteer } from './gazetteer';
let backendResults = { hello: 'world' };
const geojsonObject = {
    type: 'FeatureCollection',
    features: [
        {
            id: 'A',
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [0, 0],
            },
            properties: {
                hello: 'A',
            },
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [1, 1],
            },
            properties: {
                some_code: 'B',
                hello: 'B',
            },
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [2, 2],
            },
            properties: {
                an_id: 'C',
                hello: 'C',
            },
        },
    ],
};
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => ({
        get: jest.fn().mockResolvedValue(backendResults),
    }) })));
describe('Placename lookup from geojson format', () => {
    beforeEach(() => {
        backendResults = { hello: 'world' };
    });
    it('can lookup by id', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        backendResults = geojsonObject;
        const gaz = yield getGazetteer('local');
        expect(gaz.error).toBeUndefined();
        expect(getCenterPointWGS84((_a = gaz.find('A')) === null || _a === void 0 ? void 0 : _a.geometry())).toMatchInlineSnapshot(`
      [
        0,
        0,
      ]
    `);
    }));
    it('can look up by a code', () => __awaiter(void 0, void 0, void 0, function* () {
        var _b;
        backendResults = geojsonObject;
        const gaz = yield getGazetteer('airports');
        expect(gaz.error).toBeUndefined();
        expect(getCenterPointWGS84((_b = gaz.find('B')) === null || _b === void 0 ? void 0 : _b.geometry())).toMatchInlineSnapshot(`
      [
        1,
        1,
      ]
    `);
    }));
    it('can look up by an id property', () => __awaiter(void 0, void 0, void 0, function* () {
        var _c;
        backendResults = geojsonObject;
        const gaz = yield getGazetteer('airports');
        expect(gaz.error).toBeUndefined();
        expect(getCenterPointWGS84((_c = gaz.find('C')) === null || _c === void 0 ? void 0 : _c.geometry())).toMatchInlineSnapshot(`
      [
        2,
        2,
      ]
    `);
    }));
});
//# sourceMappingURL=gazetteer.test.js.map