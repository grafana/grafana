import { __assign, __awaiter, __generator } from "tslib";
import { getGazetteer } from './gazetteer';
var backendResults = { hello: 'world' };
import countriesJSON from '../../../../../gazetteer/countries.json';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return ({
        get: jest.fn().mockResolvedValue(backendResults),
    }); } })); });
describe('Placename lookup from worldmap format', function () {
    beforeEach(function () {
        backendResults = { hello: 'world' };
    });
    it('unified worldmap config', function () { return __awaiter(void 0, void 0, void 0, function () {
        var gaz;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    backendResults = countriesJSON;
                    return [4 /*yield*/, getGazetteer('countries')];
                case 1:
                    gaz = _a.sent();
                    expect(gaz.error).toBeUndefined();
                    expect(gaz.find('US')).toMatchInlineSnapshot("\n      Object {\n        \"coords\": Array [\n          -95.712891,\n          37.09024,\n        ],\n        \"props\": Object {\n          \"name\": \"United States\",\n        },\n      }\n    ");
                    // Items with 'keys' should get allow looking them up
                    expect(gaz.find('US')).toEqual(gaz.find('USA'));
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=worldmap.test.js.map