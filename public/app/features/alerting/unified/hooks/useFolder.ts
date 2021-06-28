import { FolderDTO } from 'app/types';
import { useDispatch } from 'react-redux';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
import { useEffect } from 'react';
import { fetchFolderIfNotFetchedAction } from '../state/actions';
import { initialAsyncRequestState } from '../utils/redux';

interface ReturnBag {
  folder?: FolderDTO;
  loading: boolean;
}

export function useFolder(uid?: string): ReturnBag {
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
