import React, { useState, useCallback } from 'react';
import {
  Modal,
  Button,
  Input,
  InlineLabel,
  TextArea,
  InputControl,
  Label,
  useStyles2,
  IconButton,
  RadioButtonGroup,
  Field,
} from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { useFieldArray, useForm } from 'react-hook-form';
import { TestReceiversAlert } from 'app/plugins/datasource/alertmanager/types';
import { css, cx } from '@emotion/css';
import { AnnotationKeyInput } from '../../rule-editor/AnnotationKeyInput';

interface Props {
  isOpen: boolean;
  onDismiss: () => void;
  onTest: (alert?: TestReceiversAlert) => void;
}

type AnnoField = {
  name: string;
  value: string;
};

interface FormFields {
  annotations: AnnoField[];
  labels: AnnoField[];
}

enum NotificationType {
  predefined = 'Predefined',
  custom = 'Custom',
}

const notificationOptions = Object.values(NotificationType).map((value) => ({ label: value, value: value }));

const defaultValues: FormFields = {
  annotations: [{ name: '', value: '' }],
  labels: [{ name: '', value: '' }],
};

const reservedAnnotations = ['summary'];
const reservedLabelKeys = ['alertname', 'instance'];

export const TestNotificationChannelModal = ({ isOpen, onDismiss, onTest }: Props) => {
  const [notificationType, setNotificationType] = useState<NotificationType>(NotificationType.predefined);
  const styles = useStyles2(getStyles);
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormFields>({ defaultValues, mode: 'onBlur' });
  const annotationFields = watch('annotations');

  const existingKeys = useCallback(
    (index: number): string[] => [
      ...reservedAnnotations,
      ...annotationFields.filter((_, idx: number) => idx !== index).map(({ name }) => name),
    ],
    [annotationFields]
  );

  const { append: addAnnotation, fields: annotations = [], remove: removeAnnotation } = useFieldArray<FormFields>({
    control,
    name: 'annotations',
  });
  const { append: addLabel, fields: labels = [], remove: removeLabel } = useFieldArray<FormFields>({
    control,
    name: 'labels',
  });

  const onSubmit = (data: FormFields) => {
    if (notificationType === NotificationType.custom) {
      const alert = {
        annotations: data.annotations
          .filter(({ name, value }) => !!name && !!value)
          .reduce((acc, { name, value }) => {
            return { ...acc, [name]: value };
          }, {}),
        labels: data.labels
          .filter(({ name, value }) => !!name && !!value)
          .reduce((acc, { name, value }) => {
            return { ...acc, [name]: value };
          }, {}),
      };
      onTest(alert);
    } else {
      onTest();
    }
  };

  return (
    <Modal onDismiss={onDismiss} isOpen={isOpen} title={'Test contact point'}>
      <div className={styles.section}>
        <Label>Notification message</Label>
        <RadioButtonGroup
          options={notificationOptions}
          value={notificationType}
          onChange={(value) => setNotificationType(value)}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {notificationType === NotificationType.predefined && (
          <div className={styles.section}>
            You will send a test notification that uses a predefined alert. If you have defined a custom template or
            message, for better results switch to <strong>custom</strong> notification message, from above.
          </div>
        )}
        {notificationType === NotificationType.custom && (
          <>
            <div className={styles.section}>
              You will send a test notification that uses the annotations defined below. This is a good option if you
              use custom templates and messages.
            </div>
            <div className={styles.section}>
              <Label>Annotations</Label>
              {annotations.map((field, index) => {
                const isUrl = annotationFields[index]?.name?.toLocaleLowerCase().endsWith('url');
                const ValueInputComponent = isUrl ? Input : TextArea;
                return (
                  <div key={field.id} className={styles.inputRow}>
                    <InputControl
                      name={`annotations.${index}.name`}
                      render={({ field: { ref, ...field } }) => (
                        <AnnotationKeyInput {...field} existingKeys={existingKeys(index)} width={24} />
                      )}
                      control={control}
                      rules={{ required: { value: !!annotations[index]?.value, message: 'Required.' } }}
                    />
                    <ValueInputComponent
                      className={cx({ [styles.annotationTextArea]: !isUrl })}
                      {...register(`annotations.${index}.value`)}
                      placeholder={isUrl ? 'https://' : `Text`}
                    />
                    <IconButton
                      name="trash-alt"
                      title="remove"
                      aria-label="remove"
                      onClick={() => removeAnnotation(index)}
                    />
                  </div>
                );
              })}
              <Button
                className={styles.annotationButton}
                type="button"
                variant="secondary"
                icon="plus-circle"
                onClick={() => addAnnotation({ name: '', value: '' })}
              >
                Add annotation
              </Button>
            </div>
            <div className={styles.section}>
              <Label>Custom labels</Label>
              <div className={styles.flexRow}>
                <div>
                  <InlineLabel width={18}>Labels</InlineLabel>
                </div>
                <div>
                  {labels.map((field, index) => (
                    <div className={styles.inputRow} key={field.id}>
                      <Field
                        invalid={!!(errors.labels && errors.labels[index]?.name)}
                        error={errors.labels && errors.labels[index]?.name?.message}
                      >
                        <Input
                          {...register(`labels.${index}.name`, {
                            validate: (value) =>
                              !reservedLabelKeys.includes(value) || `${value} is a reserved label key`,
                          })}
                          placeholder="Name"
                        />
                      </Field>
                      <InlineLabel className={styles.equalSign}>=</InlineLabel>
                      <Field
                        invalid={!!(errors.labels && errors.labels[index]?.value)}
                        error={errors.labels && errors.labels[index]?.value?.message}
                      >
                        <Input {...register(`labels.${index}.value`)} placeholder="Value" />
                      </Field>
                      <IconButton
                        name="trash-alt"
                        title="remove"
                        aria-label="remove"
                        onClick={() => removeLabel(index)}
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    icon="plus-circle"
                    onClick={() => addLabel({ name: '', value: '' })}
                  >
                    Add label
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        <Modal.ButtonRow>
          <Button type="submit">Test alert</Button>
        </Modal.ButtonRow>
      </form>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  flexRow: css`
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    margin-bottom: ${theme.spacing(1)};
  `,
  annotationButton: css`
    margin-left: 150px;
  `,
  section: css`
    margin-bottom: ${theme.spacing(2)};
  `,
  inputRow: css`
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(1)};
  `,
  equalSign: css`
    align-self: flex-start;
    width: 28px;
    justify-content: center;
  `,
  annotationTextArea: css`
    min-height: ${theme.spacing(10)};
  `,
});
