import { __awaiter, __generator } from "tslib";
import React from 'react';
import debounce from 'debounce-promise';
import { AsyncSelect } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';
/**
 * @deprecated prefer using dashboard uid rather than id
 */
export var DashboardPickerByID = function (_a) {
    var propsOnChange = _a.onChange, value = _a.value, width = _a.width, _b = _a.isClearable, isClearable = _b === void 0 ? false : _b, invalid = _a.invalid, disabled = _a.disabled, id = _a.id;
    var debouncedSearch = debounce(getDashboards, 300);
    var option = value ? { value: value, label: value.label } : undefined;
    var onChange = function (item) {
        propsOnChange(item === null || item === void 0 ? void 0 : item.value);
    };
    return (React.createElement(AsyncSelect, { inputId: id, menuShouldPortal: true, width: width, isClearable: isClearable, defaultOptions: true, loadOptions: debouncedSearch, onChange: onChange, placeholder: "Select dashboard", noOptionsMessage: "No dashboards found", value: option, invalid: invalid, disabled: disabled }));
};
function getDashboards(query) {
    if (query === void 0) { query = ''; }
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, backendSrv.search({ type: 'dash-db', query: query, limit: 100 })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.map(function (_a) {
                            var id = _a.id, _b = _a.uid, uid = _b === void 0 ? '' : _b, title = _a.title, folderTitle = _a.folderTitle;
                            var value = {
                                id: id,
                                uid: uid,
                                label: (folderTitle !== null && folderTitle !== void 0 ? folderTitle : 'General') + "/" + title,
                            };
                            return { value: value, label: value.label };
                        })];
            }
        });
    });
}
//# sourceMappingURL=DashboardPickerByID.js.map