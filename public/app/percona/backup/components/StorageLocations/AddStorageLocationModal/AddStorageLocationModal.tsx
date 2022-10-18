import { cx } from '@emotion/css';
import {
  Modal,
  TextInputField,
  TextareaInputField,
  RadioButtonGroupField,
  validators,
  LoaderButton,
} from '@percona/platform-core';
import React, { FC } from 'react';
import { withTypes } from 'react-final-form';

import { SelectableValue } from '@grafana/data';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';

import { LocationType } from '../StorageLocations.types';

import { toFormStorageLocation, toStorageLocation } from './AddStorageLocation.utils';
import { MAX_NAME_LENGTH } from './AddStorageLocationModal.constants';
import { Messages } from './AddStorageLocationModal.messages';
import { getStyles } from './AddStorageLocationModal.styles';
import {
  AddStorageLocationFormProps,
  AddStorageLocationModalProps,
  TypeFieldProps,
} from './AddStorageLocationModal.types';
import { LocalFields } from './LocalFields';
import { S3Fields } from './S3Fields';

const TypeField: FC<TypeFieldProps> = ({ values }) => {
  const { type, client, endpoint, accessKey, secretKey, bucketName } = values;
  const fieldMap = {
    [LocationType.S3]: (
      <S3Fields endpoint={endpoint} bucketName={bucketName} accessKey={accessKey} secretKey={secretKey} />
    ),
    [LocationType.CLIENT]: <LocalFields name="client" path={client} />,
  };

  return type in fieldMap ? fieldMap[type] : null;
};

const typeOptions: Array<SelectableValue<LocationType>> = [
  {
    value: LocationType.S3,
    label: 'S3',
  },
  {
    value: LocationType.CLIENT,
    label: 'Local Client',
  },
];

const { Form } = withTypes<AddStorageLocationFormProps>();

export const AddStorageLocationModal: FC<AddStorageLocationModalProps> = ({
  isVisible,
  location = null,
  waitingLocationValidation = false,
  onClose = () => null,
  onAdd = () => null,
  onTest = () => null,
}) => {
  const initialValues = toFormStorageLocation(location);
  const styles = useStyles(getStyles);
  const onSubmit = (values: AddStorageLocationFormProps) => onAdd(toStorageLocation(values));
  const handleTest = (values: AddStorageLocationFormProps) => onTest(toStorageLocation(values));

  return (
    <Modal title={location ? Messages.editTitle : Messages.addTitle} isVisible={isVisible} onClose={onClose}>
      <Form
        initialValues={initialValues}
        onSubmit={onSubmit}
        render={({ handleSubmit, valid, pristine, submitting, values }) => (
          <form onSubmit={handleSubmit} data-testid="add-storage-location-modal-form">
            <TextInputField
              inputProps={{ maxLength: MAX_NAME_LENGTH }}
              name="name"
              label={Messages.name}
              validators={[validators.required, validators.maxLength(MAX_NAME_LENGTH)]}
            />
            <TextareaInputField name="description" label={Messages.description} />
            <RadioButtonGroupField options={typeOptions} name="type" label={Messages.type} fullWidth />
            <TypeField values={values} />
            <HorizontalGroup justify="center" spacing="md">
              <LoaderButton
                className={styles.button}
                data-testid="storage-location-add-button"
                size="md"
                variant="primary"
                disabled={!valid || pristine || waitingLocationValidation}
                loading={submitting}
                type="submit"
              >
                {location ? Messages.editAction : Messages.addAction}
              </LoaderButton>
              {values.type === LocationType.S3 && (
                <LoaderButton
                  type="button"
                  className={cx(styles.button, styles.testButton)}
                  data-testid="storage-location-test-button"
                  size="md"
                  loading={waitingLocationValidation}
                  disabled={!valid}
                  onClick={() => handleTest(values)}
                >
                  {Messages.test}
                </LoaderButton>
              )}
              <Button
                className={styles.button}
                data-testid="storage-location-cancel-button"
                variant="secondary"
                onClick={onClose}
              >
                {Messages.cancelAction}
              </Button>
            </HorizontalGroup>
          </form>
        )}
      />
    </Modal>
  );
};
