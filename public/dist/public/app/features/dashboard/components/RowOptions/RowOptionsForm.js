import { __assign, __read } from "tslib";
import React, { useCallback, useState } from 'react';
import { Button, Field, Form, Modal, Input } from '@grafana/ui';
import { RepeatRowSelect } from '../RepeatRowSelect/RepeatRowSelect';
export var RowOptionsForm = function (_a) {
    var repeat = _a.repeat, title = _a.title, onUpdate = _a.onUpdate, onCancel = _a.onCancel;
    var _b = __read(useState(repeat), 2), newRepeat = _b[0], setNewRepeat = _b[1];
    var onChangeRepeat = useCallback(function (name) { return setNewRepeat(name); }, [setNewRepeat]);
    return (React.createElement(Form, { defaultValues: { title: title }, onSubmit: function (formData) {
            onUpdate(formData.title, newRepeat);
        } }, function (_a) {
        var register = _a.register;
        return (React.createElement(React.Fragment, null,
            React.createElement(Field, { label: "Title" },
                React.createElement(Input, __assign({}, register('title'), { type: "text" }))),
            React.createElement(Field, { label: "Repeat for" },
                React.createElement(RepeatRowSelect, { repeat: newRepeat, onChange: onChangeRepeat })),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { type: "button", variant: "secondary", onClick: onCancel, fill: "outline" }, "Cancel"),
                React.createElement(Button, { type: "submit" }, "Update"))));
    }));
};
//# sourceMappingURL=RowOptionsForm.js.map