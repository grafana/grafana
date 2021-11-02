import { __assign, __awaiter, __generator } from "tslib";
import { locationService } from '@grafana/runtime';
import { getSnapshots } from './SnapshotListTable';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return ({
        get: jest.fn().mockResolvedValue([
            {
                name: 'Snap 1',
                key: 'JRXqfKihKZek70FM6Xaq502NxH7OyyEs',
                external: true,
                externalUrl: 'https://www.externalSnapshotUrl.com',
            },
            {
                id: 3,
                name: 'Snap 2',
                key: 'RziRfhlBDTjwyYGoHAjnWyrMNQ1zUg3j',
                external: false,
                externalUrl: '',
            },
        ]),
    }); } })); });
describe('getSnapshots', function () {
    global.window = Object.create(window);
    Object.defineProperty(window, 'location', {
        value: {
            href: 'http://localhost:3000/grafana/dashboard/snapshots',
        },
        writable: true,
    });
    locationService.push('/dashboard/snapshots');
    test('returns correct snapshot urls', function () { return __awaiter(void 0, void 0, void 0, function () {
        var results;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getSnapshots()];
                case 1:
                    results = _a.sent();
                    expect(results).toMatchInlineSnapshot("\n      Array [\n        Object {\n          \"external\": true,\n          \"externalUrl\": \"https://www.externalSnapshotUrl.com\",\n          \"key\": \"JRXqfKihKZek70FM6Xaq502NxH7OyyEs\",\n          \"name\": \"Snap 1\",\n          \"url\": \"/dashboard/snapshot/JRXqfKihKZek70FM6Xaq502NxH7OyyEs\",\n        },\n        Object {\n          \"external\": false,\n          \"externalUrl\": \"\",\n          \"id\": 3,\n          \"key\": \"RziRfhlBDTjwyYGoHAjnWyrMNQ1zUg3j\",\n          \"name\": \"Snap 2\",\n          \"url\": \"/dashboard/snapshot/RziRfhlBDTjwyYGoHAjnWyrMNQ1zUg3j\",\n        },\n      ]\n    ");
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=SnapshotListTable.test.js.map