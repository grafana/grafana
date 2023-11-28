import React, { useMemo } from 'react';
import { useStyles2 } from '@grafana/ui';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { TextareaInputField } from 'app/percona/shared/components/Form/TextareaInput';
import Validators from 'app/percona/shared/helpers/validators';
import { Messages } from '../FormParts.messages';
import { getStyles } from '../FormParts.styles';
export const LabelsFormPart = ({ showNodeFields = true }) => {
    const styles = useStyles2(getStyles);
    const customLabelsValidators = useMemo(() => [Validators.validateKeyValue], []);
    return (React.createElement("div", { className: styles.groupWrapper },
        React.createElement("h4", { className: styles.sectionHeader }, Messages.form.titles.labels),
        React.createElement("p", null,
            Messages.form.descriptions.labels,
            Messages.form.descriptions.dot,
            Messages.form.descriptions.labelsExisting),
        React.createElement("div", { className: styles.group },
            React.createElement(TextInputField, { name: "environment", label: Messages.form.labels.labels.environment, placeholder: Messages.form.placeholders.labels.environment }),
            React.createElement(TextInputField, { name: "cluster", label: Messages.form.labels.labels.cluster, placeholder: Messages.form.placeholders.labels.cluster })),
        React.createElement("div", { className: styles.group },
            React.createElement(TextInputField, { name: "replication_set", label: Messages.form.labels.labels.replicationSet, placeholder: Messages.form.placeholders.labels.replicationSet }),
            showNodeFields ? (React.createElement(TextInputField, { name: "region", placeholder: Messages.form.placeholders.labels.region, label: Messages.form.labels.labels.region, tooltipText: Messages.form.tooltips.labels.region })) : (React.createElement("div", null))),
        showNodeFields && (React.createElement("div", { className: styles.group },
            React.createElement(TextInputField, { name: "az", placeholder: Messages.form.placeholders.labels.az, label: Messages.form.labels.labels.az, tooltipText: Messages.form.tooltips.labels.az }),
            React.createElement("div", null))),
        React.createElement("div", { className: styles.group },
            React.createElement(TextareaInputField, { name: "custom_labels", label: React.createElement("div", null,
                    React.createElement("label", { htmlFor: "input-custom_labels-id" }, Messages.form.labels.labels.customLabels),
                    React.createElement("p", { className: styles.description }, Messages.form.descriptions.customLabels)), placeholder: Messages.form.placeholders.labels.customLabels, validators: customLabelsValidators }),
            React.createElement("div", null))));
};
//# sourceMappingURL=Labels.js.map