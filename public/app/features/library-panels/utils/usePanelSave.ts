import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import useAsyncFn from 'react-use/lib/useAsyncFn';

import { PanelModel } from 'app/features/dashboard/state';
import {
  createPanelLibraryErrorNotification,
  createPanelLibrarySuccessNotification,
  saveAndRefreshLibraryPanel,
} from '../utils';
import { notifyApp } from 'app/core/actions';

export const usePanelSave = () => {
  const dispatch = useDispatch();
  const [state, saveLibraryPanel] = useAsyncFn(async (panel: PanelModel, folderId: number) => {
    try {
      return await saveAndRefreshLibraryPanel(panel, folderId);
    } catch (err) {
      err.isHandled = true;
      throw new Error(err.data.message);
    }
  }, []);

  useEffect(() => {
    if (state.error) {
      dispatch(notifyApp(createPanelLibraryErrorNotification(`Error saving library panel: "${state.error.message}"`)));
    }
    if (state.value) {
      dispatch(notifyApp(createPanelLibrarySuccessNotification('Library panel saved')));
    }
  }, [dispatch, state]);

  return { state, saveLibraryPanel };
};
