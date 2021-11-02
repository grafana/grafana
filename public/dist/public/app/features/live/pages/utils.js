import { __awaiter, __generator } from "tslib";
import { getBackendSrv } from '@grafana/runtime';
export function getPipeLineEntities() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv()
                        .get("api/live/pipeline-entities")
                        .then(function (data) {
                        return {
                            converter: transformLabel(data, 'converters'),
                            frameProcessors: transformLabel(data, 'frameProcessors'),
                            frameOutputs: transformLabel(data, 'frameOutputs'),
                            getExample: function (ruleType, type) {
                                var _a, _b, _c;
                                return (_c = (_b = (_a = data[ruleType + "s"]) === null || _a === void 0 ? void 0 : _a.filter(function (option) { return option.type === type; })) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c['example'];
                            },
                        };
                    })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
export function transformLabel(data, key) {
    if (Array.isArray(data)) {
        return data.map(function (d) { return ({
            label: d[key],
            value: d[key],
        }); });
    }
    return data[key].map(function (typeObj) { return ({
        label: typeObj.type,
        value: typeObj.type,
    }); });
}
//# sourceMappingURL=utils.js.map