import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { cleanUpAction } from '../actions/cleanUp';
export function useCleanup(stateSelector) {
    var dispatch = useDispatch();
    //bit of a hack to unburden user from having to wrap stateSelcetor in a useCallback. Otherwise cleanup would happen on every render
    var selectorRef = useRef(stateSelector);
    selectorRef.current = stateSelector;
    useEffect(function () {
        return function () {
            dispatch(cleanUpAction({ stateSelector: selectorRef.current }));
        };
    }, [dispatch]);
}
//# sourceMappingURL=useCleanup.js.map