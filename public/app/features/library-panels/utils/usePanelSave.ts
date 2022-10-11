import { useEffect } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';

import { isFetchError } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { t } from 'app/core/internationalization';
import { PanelModel } from 'app/features/dashboard/state';
import { useDispatch } from 'app/types';

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
            t('library-panels.save.error', 'Error saving library panel: "{{errorMsg}}"', { errorMsg })
          )
        )
      );
    }
    if (state.value) {
      dispatch(
        notifyApp(createPanelLibrarySuccessNotification(t('library-panels.save.success', 'Library panel saved')))
      );
    }
  }, [dispatch, state]);

  return { state, saveLibraryPanel };
};
