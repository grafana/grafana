import { __awaiter, __generator, __values } from "tslib";
import useAsync from 'react-use/lib/useAsync';
import { getDataSourceSrv } from '@grafana/runtime';
import { useMemo } from 'react';
import { supportsDataQuery } from '../PanelEditor/utils';
import { InspectTab } from 'app/features/inspector/types';
/**
 * Given PanelData return first data source supporting metadata inspector
 */
export var useDatasourceMetadata = function (data) {
    var state = useAsync(function () { return __awaiter(void 0, void 0, void 0, function () {
        var targets, _a, _b, frame, dataSource, e_1_1;
        var e_1, _c;
        var _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    targets = ((_d = data === null || data === void 0 ? void 0 : data.request) === null || _d === void 0 ? void 0 : _d.targets) || [];
                    if (!(data && data.series && targets.length)) return [3 /*break*/, 8];
                    _f.label = 1;
                case 1:
                    _f.trys.push([1, 6, 7, 8]);
                    _a = __values(data.series), _b = _a.next();
                    _f.label = 2;
                case 2:
                    if (!!_b.done) return [3 /*break*/, 5];
                    frame = _b.value;
                    if (!(frame.meta && frame.meta.custom)) return [3 /*break*/, 4];
                    return [4 /*yield*/, getDataSourceSrv().get(targets[0].datasource)];
                case 3:
                    dataSource = _f.sent();
                    if (dataSource && ((_e = dataSource.components) === null || _e === void 0 ? void 0 : _e.MetadataInspector)) {
                        return [2 /*return*/, dataSource];
                    }
                    _f.label = 4;
                case 4:
                    _b = _a.next();
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 8];
                case 6:
                    e_1_1 = _f.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 8];
                case 7:
                    try {
                        if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                    }
                    finally { if (e_1) throw e_1.error; }
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/, undefined];
            }
        });
    }); }, [data]);
    return state.value;
};
/**
 * Configures tabs for PanelInspector
 */
export var useInspectTabs = function (panel, dashboard, plugin, error, metaDs) {
    return useMemo(function () {
        var tabs = [];
        if (supportsDataQuery(plugin)) {
            tabs.push({ label: 'Data', value: InspectTab.Data });
            tabs.push({ label: 'Stats', value: InspectTab.Stats });
        }
        if (metaDs) {
            tabs.push({ label: 'Meta Data', value: InspectTab.Meta });
        }
        tabs.push({ label: 'JSON', value: InspectTab.JSON });
        if (error && error.message) {
            tabs.push({ label: 'Error', value: InspectTab.Error });
        }
        // This is a quick internal hack to allow custom actions in inspect
        // For 8.1, something like this should be exposed through grafana/runtime
        var supplier = window.grafanaPanelInspectActionSupplier;
        if (supplier && supplier.getActions(panel)) {
            tabs.push({ label: 'Actions', value: InspectTab.Actions });
        }
        if (dashboard.meta.canEdit && supportsDataQuery(plugin)) {
            tabs.push({ label: 'Query', value: InspectTab.Query });
        }
        return tabs;
    }, [panel, plugin, metaDs, dashboard, error]);
};
//# sourceMappingURL=hooks.js.map