import { css } from '@emotion/css';
import React, { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Button, Label, Modal, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { defaultAnnotations } from '../../../utils/constants';
import AnnotationsStep from '../../rule-editor/AnnotationsStep';
import LabelsField from '../../rule-editor/LabelsField';
var NotificationType;
(function (NotificationType) {
    NotificationType["predefined"] = "Predefined";
    NotificationType["custom"] = "Custom";
})(NotificationType || (NotificationType = {}));
const notificationOptions = Object.values(NotificationType).map((value) => ({ label: value, value: value }));
const defaultValues = {
    annotations: [...defaultAnnotations],
    labels: [{ key: '', value: '' }],
};
export const TestContactPointModal = ({ isOpen, onDismiss, onTest }) => {
    const [notificationType, setNotificationType] = useState(NotificationType.predefined);
    const styles = useStyles2(getStyles);
    const formMethods = useForm({ defaultValues, mode: 'onBlur' });
    const onSubmit = (data) => {
        if (notificationType === NotificationType.custom) {
            const alert = {
                annotations: data.annotations
                    .filter(({ key, value }) => !!key && !!value)
                    .reduce((acc, { key, value }) => {
                    return Object.assign(Object.assign({}, acc), { [key]: value });
                }, {}),
                labels: data.labels
                    .filter(({ key, value }) => !!key && !!value)
                    .reduce((acc, { key, value }) => {
                    return Object.assign(Object.assign({}, acc), { [key]: value });
                }, {}),
            };
            onTest(alert);
        }
        else {
            onTest();
        }
    };
    return (React.createElement(Modal, { onDismiss: onDismiss, isOpen: isOpen, title: 'Test contact point' },
        React.createElement("div", { className: styles.section },
            React.createElement(Label, null, "Notification message"),
            React.createElement(RadioButtonGroup, { options: notificationOptions, value: notificationType, onChange: (value) => setNotificationType(value) })),
        React.createElement(FormProvider, Object.assign({}, formMethods),
            React.createElement("form", { onSubmit: formMethods.handleSubmit(onSubmit) },
                notificationType === NotificationType.predefined && (React.createElement("div", { className: styles.section },
                    "You will send a test notification that uses a predefined alert. If you have defined a custom template or message, for better results switch to ",
                    React.createElement("strong", null, "custom"),
                    " notification message, from above.")),
                notificationType === NotificationType.custom && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: styles.section }, "You will send a test notification that uses the annotations defined below. This is a good option if you use custom templates and messages."),
                    React.createElement("div", { className: styles.section },
                        React.createElement(AnnotationsStep, null)),
                    React.createElement("div", { className: styles.section },
                        React.createElement(LabelsField, null)))),
                React.createElement(Modal.ButtonRow, null,
                    React.createElement(Button, { type: "submit" }, "Send test notification"))))));
};
const getStyles = (theme) => ({
    flexRow: css `
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    margin-bottom: ${theme.spacing(1)};
  `,
    section: css `
    margin-bottom: ${theme.spacing(2)};
  `,
});
//# sourceMappingURL=TestContactPointModal.js.map