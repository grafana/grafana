import { useSelector } from 'react-redux';
export function useUnifiedAlertingSelector(selector, equalityFn) {
    return useSelector(function (state) { return selector(state.unifiedAlerting); }, equalityFn);
}
//# sourceMappingURL=useUnifiedAlertingSelector.js.map