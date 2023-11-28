import { cx } from '@emotion/css';
import React from 'react';
import { withTypes } from 'react-final-form';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';
import { Modal } from 'app/percona/shared/components/Elements/Modal';
import { RadioButtonGroupField } from 'app/percona/shared/components/Form/RadioButtonGroup';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { TextareaInputField } from 'app/percona/shared/components/Form/TextareaInput';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { LocationType } from '../StorageLocations.types';
import { toFormStorageLocation, toStorageLocation } from './AddStorageLocation.utils';
import { MAX_NAME_LENGTH } from './AddStorageLocationModal.constants';
import { Messages } from './AddStorageLocationModal.messages';
import { getStyles } from './AddStorageLocationModal.styles';
import { LocalFields } from './LocalFields';
import { S3Fields } from './S3Fields';
const TypeField = ({ values }) => {
    const { type, client, endpoint, accessKey, secretKey, bucketName } = values;
    const fieldMap = {
        [LocationType.S3]: (
        // eslint-disable-next-line jsx-a11y/no-access-key
        (React.createElement(S3Fields, { endpoint: endpoint, bucketName: bucketName, accessKey: accessKey, secretKey: secretKey }))),
        [LocationType.CLIENT]: React.createElement(LocalFields, { name: "client", path: client }),
    };
    return type in fieldMap ? fieldMap[type] : null;
};
const typeOptions = [
    {
        value: LocationType.S3,
        label: 'S3',
    },
    {
        value: LocationType.CLIENT,
        label: 'Local Client',
    },
];
const { Form } = withTypes();
export const AddStorageLocationModal = ({ isVisible, location = null, waitingLocationValidation = false, onClose = () => null, onAdd = () => null, onTest = () => null, }) => {
    const initialValues = toFormStorageLocation(location);
    const styles = useStyles(getStyles);
    const onSubmit = (values) => onAdd(toStorageLocation(values));
    const handleTest = (values) => onTest(toStorageLocation(values));
    return (React.createElement(Modal, { title: location ? Messages.editTitle : Messages.addTitle, isVisible: isVisible, onClose: onClose },
        React.createElement(Form, { initialValues: initialValues, onSubmit: onSubmit, render: ({ handleSubmit, valid, pristine, submitting, values }) => (React.createElement("form", { onSubmit: handleSubmit, "data-testid": "add-storage-location-modal-form" },
                React.createElement(TextInputField, { inputProps: { maxLength: MAX_NAME_LENGTH }, name: "name", label: Messages.name, validators: [validators.required, validators.maxLength(MAX_NAME_LENGTH)] }),
                React.createElement(TextareaInputField, { name: "description", label: Messages.description }),
                React.createElement(RadioButtonGroupField, { options: typeOptions, name: "type", label: Messages.type, fullWidth: true }),
                React.createElement(TypeField, { values: values }),
                React.createElement(HorizontalGroup, { justify: "center", spacing: "md" },
                    React.createElement(LoaderButton, { className: styles.button, "data-testid": "storage-location-add-button", size: "md", variant: "primary", disabled: !valid || pristine || waitingLocationValidation, loading: submitting, type: "submit" }, location ? Messages.editAction : Messages.addAction),
                    values.type === LocationType.S3 && (React.createElement(LoaderButton, { type: "button", className: cx(styles.button, styles.testButton), "data-testid": "storage-location-test-button", size: "md", loading: waitingLocationValidation, disabled: !valid, onClick: () => handleTest(values) }, Messages.test)),
                    React.createElement(Button, { className: styles.button, "data-testid": "storage-location-cancel-button", variant: "secondary", onClick: onClose }, Messages.cancelAction)))) })));
};
//# sourceMappingURL=AddStorageLocationModal.js.map