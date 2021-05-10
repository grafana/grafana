import React, { FC } from 'react';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { Field, withTypes } from 'react-final-form';
import { Modal, LoaderButton, RadioButtonGroupField, TextInputField, validators } from '@percona/platform-core';
import { SelectField } from 'app/percona/shared/components/Form/SelectField';
import { RestoreBackupModalProps, RestoreBackupFormProps, ServiceTypeSelect } from './RestoreBackupModal.types';
import { Messages } from './RestoreBackupModal.messages';
import { getStyles } from './RestoreBackupModal.styles';
import { toFormProps } from './RestoreBackupModal.utils';

const { Form } = withTypes<RestoreBackupFormProps>();

const serviceTypeOptions: Array<SelectableValue<ServiceTypeSelect>> = [
  {
    value: ServiceTypeSelect.SAME,
    label: 'Same service',
  },
  {
    value: ServiceTypeSelect.COMPATIBLE,
    label: 'Compatible services',
  },
];

export const RestoreBackupModal: FC<RestoreBackupModalProps> = ({ backup, isVisible, onClose, onRestore }) => {
  const styles = useStyles(getStyles);
  const initialValues = backup ? toFormProps(backup) : undefined;
  const handleSubmit = ({ serviceType, service }: RestoreBackupFormProps) => {
    if (backup) {
      const serviceId = serviceType === ServiceTypeSelect.SAME ? backup.serviceId : service.value;
      onRestore(serviceId || '', backup.id);
    }
  };

  return (
    <Modal isVisible={isVisible} title={Messages.title} onClose={onClose}>
      <Form
        initialValues={initialValues}
        onSubmit={handleSubmit}
        render={({ handleSubmit, valid, submitting, values }) => (
          <form onSubmit={handleSubmit}>
            <div className={styles.formHalvesContainer}>
              <div>
                <RadioButtonGroupField
                  disabled
                  className={styles.radioGroup}
                  options={serviceTypeOptions}
                  name="serviceType"
                  label={Messages.serviceSelection}
                  fullWidth
                />
                <TextInputField disabled name="vendor" label={Messages.vendor} />
              </div>
              <div>
                <Field name="service" validate={validators.required}>
                  {({ input }) => (
                    <div>
                      <SelectField
                        label={Messages.serviceName}
                        disabled={values.serviceType === ServiceTypeSelect.SAME}
                        options={[]}
                        {...input}
                        data-qa="service-select-input"
                      />
                    </div>
                  )}
                </Field>
                <TextInputField disabled name="dataModel" label={Messages.dataModel} />
              </div>
            </div>
            <HorizontalGroup justify="center" spacing="md">
              <LoaderButton data-qa="restore-button" size="md" variant="primary" disabled={!valid} loading={submitting}>
                {Messages.restore}
              </LoaderButton>
              <Button data-qa="restore-cancel-button" variant="secondary" onClick={onClose}>
                {Messages.close}
              </Button>
            </HorizontalGroup>
          </form>
        )}
      />
    </Modal>
  );
};
