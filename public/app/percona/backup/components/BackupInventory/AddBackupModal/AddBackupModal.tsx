import React, { FC } from 'react';
import { Button, HorizontalGroup } from '@grafana/ui';
import { LoaderButton, Modal, TextareaInputField, TextInputField, validators } from '@percona/platform-core';
import { Field, withTypes } from 'react-final-form';
import { AddBackupFormProps, AddBackupModalProps } from './AddBackupModal.types';
import { Messages } from './AddBackupModal.messages';
import { toFormBackup } from './AddBackupModal.utils';
import { AddBackupModalService } from './AddBackupModal.service';
import { Databases, DATABASE_LABELS } from 'app/percona/shared/core';
import { AsyncSelectField } from 'app/percona/shared/components/Form/AsyncSelectField';

export const AddBackupModal: FC<AddBackupModalProps> = ({ backup, isVisible, onClose, onBackup }) => {
  const initialValues = toFormBackup(backup);
  const { Form } = withTypes<AddBackupFormProps>();

  const handleSubmit = (values: AddBackupFormProps) => onBackup(values);

  // TODO uncomment remaining fields when we support them
  return (
    <Modal title={Messages.title} isVisible={isVisible} onClose={onClose}>
      <Form
        initialValues={initialValues}
        onSubmit={handleSubmit}
        render={({ handleSubmit, valid, pristine, submitting, values }) => (
          <form onSubmit={handleSubmit}>
            <Field name="service" validate={validators.required}>
              {({ input }) => (
                <div>
                  <AsyncSelectField
                    label={Messages.serviceName}
                    isSearchable={false}
                    loadOptions={AddBackupModalService.loadServiceOptions}
                    defaultOptions
                    {...input}
                    data-qa="service-select-input"
                  />
                </div>
              )}
            </Field>
            <TextInputField
              name="vendor"
              label={Messages.vendor}
              disabled
              defaultValue={values.service ? DATABASE_LABELS[values.service.value?.vendor as Databases] : ''}
            />
            {/* <RadioButtonGroupField options={dataModelOptions} name="dataModel" label={Messages.dataModel} fullWidth /> */}
            <TextInputField name="backupName" label={Messages.backupName} validators={[validators.required]} />
            <TextareaInputField name="description" label={Messages.description} />
            <Field name="location" validate={validators.required}>
              {({ input }) => (
                <div>
                  <AsyncSelectField
                    label={Messages.location}
                    isSearchable={false}
                    loadOptions={AddBackupModalService.loadLocationOptions}
                    defaultOptions
                    {...input}
                    data-qa="location-select-input"
                  />
                </div>
              )}
            </Field>
            {/* <RadioButtonGroupField options={retryModeOptions} name="retryMode" label={Messages.retryMode} fullWidth />
            <div className={styles.retryFields}>
              <NumberInputField fieldClassName={styles.retrySelect} name="retryTimes" label={Messages.retryTimes} />
              <NumberInputField
                fieldClassName={styles.retrySelect}
                name="retryInterval"
                label={Messages.retryInterval}
              />
            </div> */}
            <HorizontalGroup justify="center" spacing="md">
              <LoaderButton
                data-qa="backup-add-button"
                size="md"
                variant="primary"
                disabled={!valid || pristine}
                loading={submitting}
              >
                {Messages.backupAction}
              </LoaderButton>
              <Button data-qa="storage-location-cancel-button" variant="secondary" onClick={onClose}>
                {Messages.cancelAction}
              </Button>
            </HorizontalGroup>
          </form>
        )}
      />
    </Modal>
  );
};
