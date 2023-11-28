import { css } from '@emotion/css';
import { addDays, subDays } from 'date-fns';
import React, { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Stack } from '@grafana/experimental';
import { Button, Card, Modal, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import AnnotationsStep from '../../rule-editor/AnnotationsStep';
import LabelsField from '../../rule-editor/LabelsField';
const defaultValues = {
    annotations: [{ key: '', value: '' }],
    labels: [{ key: '', value: '' }],
    status: 'firing',
};
export const GenerateAlertDataModal = ({ isOpen, onDismiss, onAccept }) => {
    const styles = useStyles2(getStyles);
    const [alerts, setAlerts] = useState([]);
    const formMethods = useForm({ defaultValues, mode: 'onBlur' });
    const annotations = formMethods.watch('annotations');
    const labels = formMethods.watch('labels');
    const [status, setStatus] = useState('firing');
    const onAdd = () => {
        const alert = {
            annotations: annotations
                .filter(({ key, value }) => !!key && !!value)
                .reduce((acc, { key, value }) => {
                return Object.assign(Object.assign({}, acc), { [key]: value });
            }, {}),
            labels: labels
                .filter(({ key, value }) => !!key && !!value)
                .reduce((acc, { key, value }) => {
                return Object.assign(Object.assign({}, acc), { [key]: value });
            }, {}),
            startsAt: '2023-04-01T00:00:00Z',
            endsAt: status === 'firing' ? addDays(new Date(), 1).toISOString() : subDays(new Date(), 1).toISOString(),
        };
        setAlerts((alerts) => [...alerts, alert]);
        formMethods.reset();
    };
    const onSubmit = () => {
        onAccept(alerts);
        setAlerts([]);
        formMethods.reset();
        setStatus('firing');
    };
    const labelsOrAnnotationsAdded = () => {
        const someLabels = labels.some((lb) => lb.key !== '' && lb.value !== '');
        const someAnnotations = annotations.some((ann) => ann.key !== '' && ann.value !== '');
        return someLabels || someAnnotations;
    };
    const alertOptions = [
        {
            label: 'Firing',
            value: 'firing',
        },
        { label: 'Resolved', value: 'resolved' },
    ];
    return (React.createElement(Modal, { onDismiss: onDismiss, isOpen: isOpen, title: 'Add custom alerts' },
        React.createElement(FormProvider, Object.assign({}, formMethods),
            React.createElement("form", { onSubmit: (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    formMethods.reset();
                    setStatus('firing');
                } },
                React.createElement(React.Fragment, null,
                    React.createElement(Card, null,
                        React.createElement(Stack, { direction: "column", gap: 1 },
                            React.createElement("div", { className: styles.section },
                                React.createElement(AnnotationsStep, null)),
                            React.createElement("div", { className: styles.section },
                                React.createElement(LabelsField, null)),
                            React.createElement("div", { className: styles.flexWrapper },
                                React.createElement(RadioButtonGroup, { value: status, options: alertOptions, onChange: (value) => setStatus(value) }),
                                React.createElement(Button, { onClick: onAdd, className: styles.onAddButton, icon: "plus-circle", type: "button", variant: "secondary", disabled: !labelsOrAnnotationsAdded() }, "Add alert data"))))),
                React.createElement("div", { className: styles.onSubmitWrapper }),
                alerts.length > 0 && (React.createElement(Stack, { direction: "column", gap: 1 },
                    React.createElement("h5", null, " Review alert data to add to the payload:"),
                    React.createElement("pre", { className: styles.result, "data-testid": "payloadJSON" }, JSON.stringify(alerts, null, 2)))),
                React.createElement("div", { className: styles.onSubmitWrapper },
                    React.createElement(Modal.ButtonRow, null,
                        React.createElement(Button, { onClick: onSubmit, disabled: alerts.length === 0, className: styles.onSubmitButton }, "Add alert data to payload")))))));
};
const getStyles = (theme) => ({
    section: css `
    margin-bottom: ${theme.spacing(2)};
  `,
    onAddButton: css `
    flex: none;
    width: fit-content;
    padding-right: ${theme.spacing(1)};
    margin-left: auto;
  `,
    flexWrapper: css `
    display: flex;
    flex-direction: row,
    justify-content: space-between;
  `,
    onSubmitWrapper: css `
    display: flex;
    flex-direction: row;
    align-items: baseline;
    justify-content: flex-end;
  `,
    onSubmitButton: css `
    margin-left: ${theme.spacing(2)};
  `,
    result: css `
    width: 570px;
    height: 363px;
  `,
});
//# sourceMappingURL=GenerateAlertDataModal.js.map