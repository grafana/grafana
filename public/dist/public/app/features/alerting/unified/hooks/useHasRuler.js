import { useCallback } from 'react';
import { getRulesSourceName, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
// datasource has ruler if it's grafana managed or if we're able to load rules from it
export function useHasRuler() {
    const rulerRules = useUnifiedAlertingSelector((state) => state.rulerRules);
    const hasRuler = useCallback((rulesSource) => {
        var _a;
        const rulesSourceName = typeof rulesSource === 'string' ? rulesSource : rulesSource.name;
        return rulesSourceName === GRAFANA_RULES_SOURCE_NAME || !!((_a = rulerRules[rulesSourceName]) === null || _a === void 0 ? void 0 : _a.result);
    }, [rulerRules]);
    const rulerRulesLoaded = useCallback((rulesSource) => {
        var _a;
        const rulesSourceName = getRulesSourceName(rulesSource);
        const result = (_a = rulerRules[rulesSourceName]) === null || _a === void 0 ? void 0 : _a.result;
        return Boolean(result);
    }, [rulerRules]);
    return { hasRuler, rulerRulesLoaded };
}
//# sourceMappingURL=useHasRuler.js.map