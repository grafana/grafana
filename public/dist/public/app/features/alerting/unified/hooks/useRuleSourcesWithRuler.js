import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { checkIfLotexSupportsEditingRulesAction } from '../state/actions';
import { getRulesDataSources } from '../utils/datasource';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
export function useRulesSourcesWithRuler() {
    var checkEditingRequests = useUnifiedAlertingSelector(function (state) { return state.lotexSupportsRuleEditing; });
    var dispatch = useDispatch();
    // try fetching rules for each prometheus to see if it has ruler
    useEffect(function () {
        getRulesDataSources()
            .filter(function (ds) { return checkEditingRequests[ds.name] === undefined; })
            .forEach(function (ds) { return dispatch(checkIfLotexSupportsEditingRulesAction(ds.name)); });
    }, [dispatch, checkEditingRequests]);
    return useMemo(function () { return getRulesDataSources().filter(function (ds) { var _a; return (_a = checkEditingRequests[ds.name]) === null || _a === void 0 ? void 0 : _a.result; }); }, [
        checkEditingRequests,
    ]);
}
//# sourceMappingURL=useRuleSourcesWithRuler.js.map