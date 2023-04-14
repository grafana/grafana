import { useEffect } from 'react';

import { FolderDTO, useDispatch } from 'app/types';

import { fetchFolderIfNotFetchedAction } from '../state/actions';
import { initialAsyncRequestState } from '../utils/redux';

import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';

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
