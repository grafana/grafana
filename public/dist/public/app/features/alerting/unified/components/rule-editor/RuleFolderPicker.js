import { __assign, __rest } from "tslib";
import React from 'react';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
export var RuleFolderPicker = function (_a) {
    var value = _a.value, props = __rest(_a, ["value"]);
    return (React.createElement(FolderPicker, __assign({ showRoot: false, allowEmpty: true, initialTitle: value === null || value === void 0 ? void 0 : value.title, initialFolderId: value === null || value === void 0 ? void 0 : value.id }, props)));
};
//# sourceMappingURL=RuleFolderPicker.js.map