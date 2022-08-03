import { t } from '@lingui/macro';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import useAsyncFn from 'react-use/lib/useAsyncFn';

import { isFetchError } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { PanelModel } from 'app/features/dashboard/state';

import {
  createPanelLibraryErrorNotification,
  createPanelLibrarySuccessNotification,
  saveAndRefreshLibraryPanel,
} from '../utils';

export const usePanelSave = () => {
  const dispatch = useDispatch();
  const [state, saveLibraryPanel] = useAsyncFn(async (panel: PanelModel, folderId: number) => {
    try {
      return await saveAndRefreshLibraryPanel(panel, folderId);
    } catch (err) {
      if (isFetchError(err)) {
        err.isHandled = true;
        throw new Error(err.data.message);
      }
      throw err;
    }
  }, []);

  useEffect(() => {
    if (state.error) {
      const errorMsg = state.error.message;
      dispatch(
        notifyApp(
          createPanelLibraryErrorNotification(
            t({ id: 'library-panels.save.error', message: `Error saving library panel: "${errorMsg}"` })
          )
        )
      );
    }
    if (state.value) {
      dispatch(
        notifyApp(
          createPanelLibrarySuccessNotification(
            t({ id: 'library-panels.save.success', message: 'Library panel saved' })
          )
        )
      );
    }
  }, [dispatch, state]);

  return { state, saveLibraryPanel };
};
