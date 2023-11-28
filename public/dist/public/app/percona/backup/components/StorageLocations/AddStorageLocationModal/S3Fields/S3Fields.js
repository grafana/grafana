import React from 'react';
import { SecretToggler } from 'app/percona/shared/components/Elements/SecretToggler';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { Messages } from './S3Fields.Messages';
import { MAX_LENGTH } from './S3Fields.constants';
const required = [validators.required];
export const S3Fields = ({ endpoint, accessKey, secretKey, bucketName }) => (React.createElement(React.Fragment, null,
    React.createElement(TextInputField, { name: "endpoint", label: Messages.endpoint, validators: required, initialValue: endpoint }),
    React.createElement(TextInputField, { inputProps: { maxLength: MAX_LENGTH }, name: "bucketName", label: Messages.bucketName, validators: required, initialValue: bucketName }),
    React.createElement(TextInputField, { inputProps: { maxLength: MAX_LENGTH }, name: "accessKey", label: Messages.accessKey, validators: required, initialValue: accessKey }),
    React.createElement(SecretToggler, { fieldProps: { name: 'secretKey', label: 'Secret Key', validators: required }, secret: secretKey, maxLength: MAX_LENGTH, readOnly: false })));
//# sourceMappingURL=S3Fields.js.map