import { __awaiter } from "tslib";
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { isFetchError } from '@grafana/runtime';
import { useAppNotification } from 'app/core/copy/appNotification';
import { t } from 'app/core/internationalization';
import { saveAndRefreshLibraryPanel } from '../utils';
export const usePanelSave = () => {
    const notifyApp = useAppNotification();
    const [state, saveLibraryPanel] = useAsyncFn((panel, folderUid) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            const libEl = yield saveAndRefreshLibraryPanel(panel, folderUid);
            notifyApp.success(t('library-panels.save.success', 'Library panel saved'));
            return libEl;
        }
        catch (err) {
            if (isFetchError(err)) {
                err.isHandled = true;
                notifyApp.error(t('library-panels.save.error', 'Error saving library panel: "{{errorMsg}}"', {
                    errorMsg: (_a = err.message) !== null && _a !== void 0 ? _a : err.data.message,
                }));
            }
            throw err;
        }
    }), []);
    return { state, saveLibraryPanel };
};
//# sourceMappingURL=usePanelSave.js.map