import { useEffect } from 'react';
import { useDispatch } from 'app/types';
import { fetchFolderIfNotFetchedAction } from '../state/actions';
import { initialAsyncRequestState } from '../utils/redux';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
export function useFolder(uid) {
    const dispatch = useDispatch();
    const folderRequests = useUnifiedAlertingSelector((state) => state.folders);
    useEffect(() => {
        if (uid) {
            dispatch(fetchFolderIfNotFetchedAction(uid));
        }
    }, [dispatch, uid]);
    if (uid) {
        const request = folderRequests[uid] || initialAsyncRequestState;
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