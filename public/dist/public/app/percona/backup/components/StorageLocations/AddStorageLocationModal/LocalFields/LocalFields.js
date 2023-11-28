import React from 'react';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { Messages } from './LocalFields.messages';
const required = [validators.required];
export const LocalFields = ({ name, path }) => (React.createElement(TextInputField, { name: name, validators: required, label: Messages.path, initialValue: path }));
//# sourceMappingURL=LocalFields.js.map