import { __awaiter, __generator, __read } from "tslib";
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { createPanelLibraryErrorNotification, createPanelLibrarySuccessNotification, saveAndRefreshLibraryPanel, } from '../utils';
import { notifyApp } from 'app/core/actions';
export var usePanelSave = function () {
    var dispatch = useDispatch();
    var _a = __read(useAsyncFn(function (panel, folderId) { return __awaiter(void 0, void 0, void 0, function () {
        var err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, saveAndRefreshLibraryPanel(panel, folderId)];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    err_1 = _a.sent();
                    err_1.isHandled = true;
                    throw new Error(err_1.data.message);
                case 3: return [2 /*return*/];
            }
        });
    }); }, []), 2), state = _a[0], saveLibraryPanel = _a[1];
    useEffect(function () {
        if (state.error) {
            dispatch(notifyApp(createPanelLibraryErrorNotification("Error saving library panel: \"" + state.error.message + "\"")));
        }
        if (state.value) {
            dispatch(notifyApp(createPanelLibrarySuccessNotification('Library panel saved')));
        }
    }, [dispatch, state]);
    return { state: state, saveLibraryPanel: saveLibraryPanel };
};
//# sourceMappingURL=usePanelSave.js.map