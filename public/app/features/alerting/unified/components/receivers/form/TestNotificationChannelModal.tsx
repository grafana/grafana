import React from 'react';
import { Modal, Button, Input, Label } from '@grafana/ui';
import { useFieldArray, useForm } from 'react-hook-form';
import { TestReceiversAlert } from 'app/plugins/datasource/alertmanager/types';

interface Props {
  isOpen: boolean;
  onDismiss: () => void;
  onTest: (alert: TestReceiversAlert) => void;
}

type AnnoField = {
  name: string;
  value: string;
};

interface FormFields {
  annotations: AnnoField[];
  labels: AnnoField[];
}

const defaultValues: FormFields = {
  annotations: [{ name: '', value: '' }],
  labels: [{ name: '', value: '' }],
};

export const TestNotificationChannelModal = ({ isOpen, onDismiss, onTest }: Props) => {
  const { register, control, handleSubmit } = useForm<FormFields>({ defaultValues });
  const { append: addAnnotation, fields: annotations = [] } = useFieldArray<FormFields>({
    control,
    name: 'annotations',
  });
  const { append: addLabel, fields: labels = [] } = useFieldArray<FormFields>({ control, name: 'labels' });

  const onSubmit = (data: FormFields) => {
    const alert = {
      annotations: data.annotations.reduce((acc, { name, value }) => {
        return { ...acc, [name]: value };
      }, {}),
      labels: data.labels.reduce((acc, { name, value }) => {
        return { ...acc, [name]: value };
      }, {}),
    };
    onTest(alert);
  };

  return (
    <Modal onDismiss={onDismiss} isOpen={isOpen} title="Test alert notification">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <Label>Annotations</Label>
          {annotations.map((field, index) => (
            <div key={field.id}>
              <Input {...register(`annotations.${index}.name`, { required: true })} placeholder="Name" />
              <Input {...register(`annotations.${index}.value`)} placeholder="Value" />
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            icon="plus-circle"
            onClick={() => addAnnotation({ name: '', value: '' })}
          >
            Add annotation
          </Button>
        </div>
        <div>
          <Label>Labels</Label>
          {labels.map((field, index) => (
            <div key={field.id}>
              <Input {...register(`labels.${index}.name`, { required: true })} placeholder="Name" />
              <Input {...register(`labels.${index}.value`)} placeholder="Value" />
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

        <Modal.ButtonRow>
          <Button type="submit">Test alert</Button>
        </Modal.ButtonRow>
      </form>
    </Modal>
  );
};
