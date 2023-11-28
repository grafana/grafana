import React from 'react';
import { Field } from 'react-final-form';
import { FieldArray } from 'react-final-form-arrays';
import { Switch, useStyles, Button, Icon, Tooltip } from '@grafana/ui';
import { CheckboxField } from 'app/percona/shared/components/Elements/Checkbox';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import FieldSet from '../../../../../shared/components/Form/FieldSet/FieldSet';
import { Messages } from './NetworkAndSecurity.messages';
import { getStyles } from './NetworkAndSecurity.styles';
import { NetworkAndSecurityFields } from './NetworkAndSecurity.types';
export const NetworkAndSecurity = ({ form }) => {
    const styles = useStyles(getStyles);
    const { expose } = form.getState().values;
    return (React.createElement(FieldSet, { label: React.createElement("div", { className: styles.fieldSetLabel },
            React.createElement("div", null, Messages.fieldSets.expose),
            React.createElement(Tooltip, { content: Messages.tooltips.expose },
                React.createElement(Icon, { "data-testid": "eks-info-icon", name: "info-circle" })),
            React.createElement("div", { className: styles.fieldSetSwitch },
                React.createElement(Field, { name: NetworkAndSecurityFields.expose, type: "checkbox" }, ({ input }) => (React.createElement(Switch, Object.assign({ "data-testid": "toggle-network-and-security" }, input, { checked: undefined, value: input.checked })))))), "data-testid": "network-and-security" }, !!expose ? (React.createElement(React.Fragment, null,
        React.createElement(CheckboxField, { name: NetworkAndSecurityFields.internetFacing, label: Messages.labels.internetFacing, tooltipIcon: "info-circle", tooltipText: Messages.tooltips.internetFacing }),
        React.createElement(FieldArray, { name: NetworkAndSecurityFields.sourceRanges }, ({ fields }) => (React.createElement("div", { className: styles.fieldsWrapper },
            React.createElement(Button, { className: styles.button, variant: "secondary", onClick: () => fields.push({ sourceRange: '' }), icon: "plus" }, Messages.buttons.addNew),
            fields.map((name, index) => (React.createElement("div", { key: name, className: styles.fieldWrapper },
                React.createElement(TextInputField, { name: `${name}.sourceRange`, label: index === 0 ? Messages.labels.sourceRange : '', placeholder: Messages.placeholders.sourceRange, fieldClassName: styles.field }),
                React.createElement(Button, { "data-testid": `deleteButton-${index}`, className: styles.deleteButton, variant: "secondary", onClick: () => (index > 0 ? fields.remove(index) : fields.update(0, '')), icon: "trash-alt" }))))))))) : (React.createElement("div", null))));
};
export default NetworkAndSecurity;
//# sourceMappingURL=NetworkAndSecurity.js.map