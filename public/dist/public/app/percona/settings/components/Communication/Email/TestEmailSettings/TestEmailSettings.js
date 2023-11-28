import { __awaiter } from "tslib";
import React, { useState } from 'react';
import { Form } from 'react-final-form';
import { Button, useStyles } from '@grafana/ui';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { Messages } from './TestEmailSettings.messages';
import { getStyles } from './TestEmailSettings.styles';
export const TestEmailSettings = ({ onTest, onInput = () => null, initialValue = '' }) => {
    const [testingSettings, setTestingSettings] = useState(false);
    const styles = useStyles(getStyles);
    const handleClick = (email) => __awaiter(void 0, void 0, void 0, function* () {
        setTestingSettings(true);
        yield onTest(email);
        setTestingSettings(false);
    });
    return (React.createElement(Form, { onSubmit: () => { }, initialValues: { testEmail: initialValue }, render: ({ values, valid }) => (React.createElement("form", { className: styles.form },
            React.createElement(TextInputField, { name: "testEmail", fieldClassName: styles.input, label: Messages.testEmail, tooltipText: Messages.tooltip, validators: [validators.email], inputProps: {
                    onInput: (e) => onInput(e.currentTarget.value),
                } }),
            React.createElement(Button, { type: "button", className: styles.button, disabled: testingSettings || !values.testEmail || !valid, onClick: () => handleClick(values.testEmail) }, Messages.test))) }));
};
//# sourceMappingURL=TestEmailSettings.js.map