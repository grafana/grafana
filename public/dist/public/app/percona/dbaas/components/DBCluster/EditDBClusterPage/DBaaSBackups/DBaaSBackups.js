/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import React, { useState } from 'react';
import { Field } from 'react-final-form';
import { FieldSet, Switch, useStyles } from '@grafana/ui';
import { NumberInputField } from 'app/percona/shared/components/Form/NumberInput';
import { validators as customValidators } from 'app/percona/shared/helpers/validators';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { useSelector } from '../../../../../../types';
import { MAX_RETENTION, MIN_RETENTION } from '../../../../../backup/components/AddBackupPage/AddBackupPage.constants';
import { ScheduleSectionFields } from '../../../../../backup/components/AddBackupPage/ScheduleSection/ScheduleSectionFields/ScheduleSectionFields';
import { SelectField } from '../../../../../shared/components/Form/SelectField';
import { getBackupLocations } from '../../../../../shared/core/selectors';
import { Messages } from '././DBaaSBackups.messages';
import { getStyles } from './DBaaSBackups.styles';
import { DBaaSBackupFields } from './DBaaSBackups.types';
export const DBaaSBackups = ({ values }) => {
    const styles = useStyles(getStyles);
    const [enableBackups, setEnableBackups] = useState(false);
    const { result: locations = [], loading: locationsLoading } = useSelector(getBackupLocations);
    const locationsOptions = locations.map((location) => ({
        label: location.name,
        value: location.locationID,
    }));
    return (React.createElement(FieldSet, { label: React.createElement("div", { className: styles.fieldSetLabel },
            React.createElement("div", null, Messages.labels.enableBackups),
            React.createElement("div", { className: styles.fieldSetSwitch },
                React.createElement(Field, { name: "enableBackups", type: "checkbox" }, ({ input }) => (React.createElement(Switch, Object.assign({ onClick: () => setEnableBackups((prevState) => !prevState), "data-testid": "toggle-scheduled-backup" }, input, { checked: undefined })))))), "data-testid": "dbaas-backups" }, enableBackups ? (React.createElement(React.Fragment, null,
        React.createElement(FieldSet, { className: styles.childFildSet, label: Messages.fieldSets.backupInfo },
            React.createElement("div", { className: styles.line },
                React.createElement(Field, { name: DBaaSBackupFields.location, validate: validators.required }, ({ input }) => (React.createElement("div", { "data-testid": "location-select-wrapper" },
                    React.createElement(SelectField, Object.assign({ label: Messages.labels.location, placeholder: Messages.placeholders.location, isSearchable: false, options: locationsOptions, isLoading: locationsLoading }, input))))),
                React.createElement(NumberInputField, { name: DBaaSBackupFields.retention, label: Messages.labels.retention, defaultValue: 7, validators: [validators.required, customValidators.range(MIN_RETENTION, MAX_RETENTION)] }))),
        React.createElement(FieldSet, { className: styles.childFildSet, label: Messages.fieldSets.schedule },
            React.createElement(ScheduleSectionFields, { values: values })))) : (React.createElement("div", null))));
};
export default DBaaSBackups;
//# sourceMappingURL=DBaaSBackups.js.map