import { useSelector } from 'app/types';
export function useUnifiedAlertingSelector(selector, equalityFn) {
    return useSelector((state) => selector(state.unifiedAlerting), equalityFn);
}
//# sourceMappingURL=useUnifiedAlertingSelector.js.map