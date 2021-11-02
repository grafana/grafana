import React from 'react';
import { Input } from '../Input/Input';
import { Button } from '../Button';
import { TextArea } from '../TextArea/TextArea';
import { InlineField } from '../Forms/InlineField';
export var CertificationKey = function (_a) {
    var hasCert = _a.hasCert, label = _a.label, onChange = _a.onChange, onClick = _a.onClick, placeholder = _a.placeholder;
    return (React.createElement(InlineField, { label: label, labelWidth: 14 }, hasCert ? (React.createElement(React.Fragment, null,
        React.createElement(Input, { type: "text", disabled: true, value: "configured", width: 24 }),
        React.createElement(Button, { variant: "secondary", onClick: onClick, style: { marginLeft: 4 } }, "Reset"))) : (React.createElement(TextArea, { rows: 7, onChange: onChange, placeholder: placeholder, required: true }))));
};
//# sourceMappingURL=CertificationKey.js.map