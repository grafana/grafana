import { __awaiter, __generator } from "tslib";
import React, { useCallback } from 'react';
import { getTemplateSrv } from '@grafana/runtime';
import { LegacyVariableQueryEditor } from './LegacyVariableQueryEditor';
import { hasCustomVariableSupport, hasDatasourceVariableSupport, hasLegacyVariableSupport, hasStandardVariableSupport, } from '../guard';
import { importDataSourcePlugin } from '../../plugins/plugin_loader';
export function getVariableQueryEditor(datasource, importDataSourcePluginFunc) {
    var _a, _b;
    if (importDataSourcePluginFunc === void 0) { importDataSourcePluginFunc = importDataSourcePlugin; }
    return __awaiter(this, void 0, void 0, function () {
        var dsPlugin, dsPlugin;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (hasCustomVariableSupport(datasource)) {
                        return [2 /*return*/, datasource.variables.editor];
                    }
                    if (!hasDatasourceVariableSupport(datasource)) return [3 /*break*/, 2];
                    return [4 /*yield*/, importDataSourcePluginFunc(datasource.meta)];
                case 1:
                    dsPlugin = _c.sent();
                    if (!dsPlugin.components.QueryEditor) {
                        throw new Error('Missing QueryEditor in plugin definition.');
                    }
                    return [2 /*return*/, (_a = dsPlugin.components.QueryEditor) !== null && _a !== void 0 ? _a : null];
                case 2:
                    if (hasStandardVariableSupport(datasource)) {
                        return [2 /*return*/, StandardVariableQueryEditor];
                    }
                    if (!hasLegacyVariableSupport(datasource)) return [3 /*break*/, 4];
                    return [4 /*yield*/, importDataSourcePluginFunc(datasource.meta)];
                case 3:
                    dsPlugin = _c.sent();
                    return [2 /*return*/, (_b = dsPlugin.components.VariableQueryEditor) !== null && _b !== void 0 ? _b : LegacyVariableQueryEditor];
                case 4: return [2 /*return*/, null];
            }
        });
    });
}
export function StandardVariableQueryEditor(_a) {
    var propsDatasource = _a.datasource, propsQuery = _a.query, propsOnChange = _a.onChange;
    var onChange = useCallback(function (query) {
        propsOnChange({ refId: 'StandardVariableQuery', query: query });
    }, [propsOnChange]);
    return (React.createElement(LegacyVariableQueryEditor, { query: propsQuery.query, onChange: onChange, datasource: propsDatasource, templateSrv: getTemplateSrv() }));
}
//# sourceMappingURL=getVariableQueryEditor.js.map