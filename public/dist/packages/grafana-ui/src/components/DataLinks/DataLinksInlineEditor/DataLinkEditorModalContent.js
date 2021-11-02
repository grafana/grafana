import { __read } from "tslib";
import React, { useState } from 'react';
import { DataLinkEditor } from '../DataLinkEditor';
import { Button } from '../../Button';
import { Modal } from '../../Modal/Modal';
export var DataLinkEditorModalContent = function (_a) {
    var link = _a.link, index = _a.index, getSuggestions = _a.getSuggestions, onSave = _a.onSave, onCancel = _a.onCancel;
    var _b = __read(useState(link), 2), dirtyLink = _b[0], setDirtyLink = _b[1];
    return (React.createElement(React.Fragment, null,
        React.createElement(DataLinkEditor, { value: dirtyLink, index: index, isLast: false, suggestions: getSuggestions(), onChange: function (index, link) {
                setDirtyLink(link);
            } }),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { variant: "secondary", onClick: function () { return onCancel(index); }, fill: "outline" }, "Cancel"),
            React.createElement(Button, { onClick: function () {
                    onSave(index, dirtyLink);
                } }, "Save"))));
};
//# sourceMappingURL=DataLinkEditorModalContent.js.map