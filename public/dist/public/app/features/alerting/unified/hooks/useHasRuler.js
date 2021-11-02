import { useCallback } from 'react';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
// datasource has ruler if it's grafana managed or if we're able to load rules from it
export function useHasRuler() {
    var rulerRules = useUnifiedAlertingSelector(function (state) { return state.rulerRules; });
    return useCallback(function (rulesSource) {
        var _a;
        var rulesSourceName = typeof rulesSource === 'string' ? rulesSource : rulesSource.name;
        return rulesSourceName === GRAFANA_RULES_SOURCE_NAME || !!((_a = rulerRules[rulesSourceName]) === null || _a === void 0 ? void 0 : _a.result);
    }, [rulerRules]);
}
//# sourceMappingURL=useHasRuler.js.map