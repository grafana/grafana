import { useCallback, useState } from 'react';
import store from '../../../../../../core/store';
export const promQueryEditorExplainKey = 'PrometheusQueryEditorExplainDefault';
export const promQueryEditorRawQueryKey = 'PrometheusQueryEditorRawQueryDefault';
export const lokiQueryEditorExplainKey = 'LokiQueryEditorExplainDefault';
export const lokiQueryEditorRawQueryKey = 'LokiQueryEditorRawQueryDefault';
function getFlagValue(key, defaultValue = false) {
    const val = store.get(key);
    return val === undefined ? defaultValue : Boolean(parseInt(val, 10));
}
function setFlagValue(key, value) {
    store.set(key, value ? '1' : '0');
}
/**
 *
 * Use and store value of explain/rawquery switch in local storage.
 * Needs to be a hook with local state to trigger re-renders.
 */
export function useFlag(key, defaultValue = false) {
    const [flag, updateFlag] = useState(getFlagValue(key, defaultValue));
    const setter = useCallback((value) => {
        setFlagValue(key, value);
        updateFlag(value);
    }, [key]);
    return { flag, setFlag: setter };
}
//# sourceMappingURL=useFlag.js.map