import { __assign, __rest } from "tslib";
import React, { useCallback } from 'react';
import { DataSourcePicker } from '@grafana/runtime';
import { useRulesSourcesWithRuler } from '../../hooks/useRuleSourcesWithRuler';
export function CloudRulesSourcePicker(_a) {
    var value = _a.value, props = __rest(_a, ["value"]);
    var rulesSourcesWithRuler = useRulesSourcesWithRuler();
    var dataSourceFilter = useCallback(function (ds) {
        return !!rulesSourcesWithRuler.find(function (_a) {
            var id = _a.id;
            return id === ds.id;
        });
    }, [rulesSourcesWithRuler]);
    return React.createElement(DataSourcePicker, __assign({ noDefault: true, alerting: true, filter: dataSourceFilter, current: value }, props));
}
//# sourceMappingURL=CloudRulesSourcePicker.js.map