import React, { useMemo } from 'react';
import { AsyncSelectFieldCore } from 'app/percona/shared/components/Form/AsyncSelectFieldCore';
import { TextareaInputField } from 'app/percona/shared/components/Form/TextareaInput';
import FieldSet from '../../../../../../shared/components/Form/FieldSet/FieldSet';
import { Databases } from '../../../../../../shared/core';
import { Messages } from '../DBClusterAdvancedOptions.messages';
import { ConfigurationService } from './Configurations.service';
import { ConfigurationFields } from './Configurations.types';
export const Configurations = ({ form, mode, databaseType, k8sClusterName }) => {
    const label = useMemo(() => databaseType === Databases.mysql
        ? Messages.labels.pxcConfiguration
        : databaseType === Databases.mongodb
            ? Messages.labels.mongodbConfiguration
            : Messages.labels.commonConfiguration, [databaseType]);
    const fieldSetLabel = useMemo(() => databaseType === Databases.mysql
        ? Messages.fieldSets.pxcConfiguration
        : databaseType === Databases.mongodb
            ? Messages.fieldSets.mongodbConfiguration
            : Messages.fieldSets.commonConfiguration, [databaseType]);
    return (React.createElement(FieldSet, { label: fieldSetLabel, "data-testid": "configurations" },
        React.createElement(AsyncSelectFieldCore, { name: ConfigurationFields.storageClass, loadOptions: () => ConfigurationService.loadStorageClassOptions(k8sClusterName), defaultOptions: true, placeholder: Messages.placeholders.storageClass, label: Messages.labels.storageClass, disabled: mode === 'edit' }),
        React.createElement(TextareaInputField, { name: ConfigurationFields.configuration, label: label, inputProps: {
                onBlur: (event) => {
                    var _a;
                    form.mutators.trimConfiguration((_a = event === null || event === void 0 ? void 0 : event.target) === null || _a === void 0 ? void 0 : _a.value);
                },
            } })));
};
export default Configurations;
//# sourceMappingURL=Configurations.js.map