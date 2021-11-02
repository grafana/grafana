import { useDispatch } from 'react-redux';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
import { useEffect } from 'react';
import { fetchFolderIfNotFetchedAction } from '../state/actions';
import { initialAsyncRequestState } from '../utils/redux';
export function useFolder(uid) {
    var dispatch = useDispatch();
    var folderRequests = useUnifiedAlertingSelector(function (state) { return state.folders; });
    useEffect(function () {
        if (uid) {
            dispatch(fetchFolderIfNotFetchedAction(uid));
        }
    }, [dispatch, uid]);
    if (uid) {
        var request = folderRequests[uid] || initialAsyncRequestState;
        return {
            folder: request.result,
            loading: request.loading,
        };
    }
    return {
        loading: false,
    };
}
//# sourceMappingURL=useFolder.js.map