import useAsyncFn from 'react-use/lib/useAsyncFn';

import { PanelModel } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import { useAppNotification } from 'app/core/copy/appNotification';
import { t } from 'app/core/internationalization';
import { PanelModel as LegacyPanelModel } from 'app/features/dashboard/state';

import { saveAndRefreshLibraryPanel, saveOrUpdateLibraryPanel } from '../utils';

export const usePanelSave = () => {
  const notifyApp = useAppNotification();
  const [state, saveLibraryPanel] = useAsyncFn(async (panel: LegacyPanelModel, folderUid: string) => {
    try {
      const libEl = await saveAndRefreshLibraryPanel(panel, folderUid);
      notifyApp.success(t('library-panels.save.success', 'Library panel saved'));
      return libEl;
    } catch (err) {
      if (isFetchError(err)) {
        err.isHandled = true;
        notifyApp.error(
          t('library-panels.save.error', 'Error saving library panel: "{{errorMsg}}"', {
            errorMsg: err.message ?? err.data.message,
          })
        );
      }
      throw err;
    }
  }, []);

  return { state, saveLibraryPanel };
};

export const usePanelSave2 = () => {
  const notifyApp = useAppNotification();
  const [state, saveLibraryPanel] = useAsyncFn(async (panel: PanelModel, folderUid: string) => {
    try {
      const libEl = await saveOrUpdateLibraryPanel(panel, folderUid);
      notifyApp.success(t('library-panels.save.success', 'Library panel saved'));
      return libEl;
    } catch (err) {
      if (isFetchError(err)) {
        err.isHandled = true;
        notifyApp.error(
          t('library-panels.save.error', 'Error saving library panel: "{{errorMsg}}"', {
            errorMsg: err.message ?? err.data.message,
          })
        );
      }
      throw err;
    }
  }, []);

  return { state, saveLibraryPanel };
};
