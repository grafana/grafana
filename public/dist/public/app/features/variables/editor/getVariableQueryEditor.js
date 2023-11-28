import { __awaiter } from "tslib";
import React, { useCallback } from 'react';
import { getTemplateSrv } from '@grafana/runtime';
import { importDataSourcePlugin } from '../../plugins/plugin_loader';
import { hasCustomVariableSupport, hasDatasourceVariableSupport, hasLegacyVariableSupport, hasStandardVariableSupport, } from '../guard';
import { LegacyVariableQueryEditor } from './LegacyVariableQueryEditor';
export function getVariableQueryEditor(datasource, importDataSourcePluginFunc = importDataSourcePlugin) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        if (hasCustomVariableSupport(datasource)) {
            return datasource.variables.editor;
        }
        if (hasDatasourceVariableSupport(datasource)) {
            const dsPlugin = yield importDataSourcePluginFunc(datasource.meta);
            if (!dsPlugin.components.QueryEditor) {
                throw new Error('Missing QueryEditor in plugin definition.');
            }
            return (_a = dsPlugin.components.QueryEditor) !== null && _a !== void 0 ? _a : null;
        }
        if (hasStandardVariableSupport(datasource)) {
            return StandardVariableQueryEditor;
        }
        if (hasLegacyVariableSupport(datasource)) {
            const dsPlugin = yield importDataSourcePluginFunc(datasource.meta);
            return (_b = dsPlugin.components.VariableQueryEditor) !== null && _b !== void 0 ? _b : LegacyVariableQueryEditor;
        }
        return null;
    });
}
export function StandardVariableQueryEditor({ datasource: propsDatasource, query: propsQuery, onChange: propsOnChange, }) {
    const onChange = useCallback((query) => {
        propsOnChange({ refId: 'StandardVariableQuery', query });
    }, [propsOnChange]);
    return (React.createElement(LegacyVariableQueryEditor, { query: propsQuery.query, onChange: onChange, datasource: propsDatasource, templateSrv: getTemplateSrv() }));
}
//# sourceMappingURL=getVariableQueryEditor.js.map