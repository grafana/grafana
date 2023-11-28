import React, { useState } from 'react';
import { Field } from 'react-final-form';
import { FieldSet, Switch, useStyles } from '@grafana/ui';
import { AsyncSelectFieldCore } from 'app/percona/shared/components/Form/AsyncSelectFieldCore';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { useSelector } from '../../../../../../types';
import { SelectField } from '../../../../../shared/components/Form/SelectField';
import { getBackupLocations } from '../../../../../shared/core/selectors';
import { Messages } from './Restore.messages';
import { RestoreService } from './Restore.service';
import { getStyles } from './Restore.styles';
import { RestoreFields } from './Restore.types';
export const Restore = ({ form }) => {
    const styles = useStyles(getStyles);
    const [enableRestore, setEnableRestore] = useState(false);
    const { result: locations = [], loading: locationsLoading } = useSelector(getBackupLocations);
    const locationsOptions = locations.map((location) => ({
        label: location.name,
        value: location.locationID,
    }));
    const { restoreFrom, kubernetesCluster } = form.getState().values;
    const restoreFromValue = restoreFrom === null || restoreFrom === void 0 ? void 0 : restoreFrom.value;
    return (React.createElement(FieldSet, { label: React.createElement("div", { className: styles.fieldSetLabel },
            React.createElement("div", null, Messages.labels.enableRestore),
            React.createElement("div", { className: styles.fieldSetSwitch },
                React.createElement(Field, { name: "enableRestore", type: "checkbox" }, ({ input }) => (React.createElement(Switch, Object.assign({ onClick: () => setEnableRestore((prevState) => !prevState), "data-testid": "toggle-scheduled-restore" }, input, { checked: undefined })))))), "data-testid": "restore" }, enableRestore ? (React.createElement("div", null,
        React.createElement("div", { className: styles.line },
            React.createElement(Field, { name: RestoreFields.restoreFrom, validate: validators.required }, ({ input }) => (React.createElement("div", { "data-testid": "locations-select-wrapper" },
                React.createElement(SelectField, Object.assign({ label: Messages.labels.restoreFrom, isSearchable: false, options: locationsOptions, isLoading: locationsLoading }, input))))),
            restoreFromValue !== undefined && restoreFromValue ? (React.createElement(AsyncSelectFieldCore, { name: RestoreFields.backupArtifact, loadOptions: () => RestoreService.loadBackupArtifacts(restoreFromValue), defaultOptions: true, placeholder: Messages.placeholders.backupArtifact, label: Messages.labels.backupArtifact, validate: validators.required })) : (React.createElement("div", null))),
        (kubernetesCluster === null || kubernetesCluster === void 0 ? void 0 : kubernetesCluster.value) && (React.createElement("div", { className: styles.line },
            React.createElement(AsyncSelectFieldCore, { name: RestoreFields.secretsName, loadOptions: () => RestoreService.loadSecretsNames(kubernetesCluster === null || kubernetesCluster === void 0 ? void 0 : kubernetesCluster.value), defaultOptions: true, placeholder: Messages.placeholders.secretsName, label: Messages.labels.secretsName, validate: validators.required, tooltipIcon: "info-circle", tooltipText: Messages.tooltips.secretsName, fieldClassName: styles.asyncSelect }),
            React.createElement("div", null))))) : (React.createElement("div", null))));
};
export default Restore;
//# sourceMappingURL=Restore.js.map