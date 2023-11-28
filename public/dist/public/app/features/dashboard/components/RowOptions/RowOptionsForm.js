import React, { useCallback, useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Button, Field, Form, Modal, Input, Alert } from '@grafana/ui';
import { RepeatRowSelect } from '../RepeatRowSelect/RepeatRowSelect';
export const RowOptionsForm = ({ repeat, title, warning, onUpdate, onCancel }) => {
    const [newRepeat, setNewRepeat] = useState(repeat);
    const onChangeRepeat = useCallback((name) => setNewRepeat(name), [setNewRepeat]);
    return (React.createElement(Form, { defaultValues: { title }, onSubmit: (formData) => {
            onUpdate(formData.title, newRepeat);
        } }, ({ register }) => (React.createElement(React.Fragment, null,
        React.createElement(Field, { label: "Title" },
            React.createElement(Input, Object.assign({}, register('title'), { type: "text" }))),
        React.createElement(Field, { label: "Repeat for" },
            React.createElement(RepeatRowSelect, { repeat: newRepeat, onChange: onChangeRepeat })),
        warning && (React.createElement(Alert, { "data-testid": selectors.pages.Dashboard.Rows.Repeated.ConfigSection.warningMessage, severity: "warning", title: "", topSpacing: 3, bottomSpacing: 0 }, warning)),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { type: "button", variant: "secondary", onClick: onCancel, fill: "outline" }, "Cancel"),
            React.createElement(Button, { type: "submit" }, "Update"))))));
};
//# sourceMappingURL=RowOptionsForm.js.map