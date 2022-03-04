import React, { FC } from 'react';
import { Form, Field, Input, HorizontalGroup, Button, VerticalGroup } from '@grafana/ui';
interface FormDTO {
  title: string;
}

interface Props {
  onSubmit: (values: FormDTO) => void;
  onCancel: () => void;
}

export const StoryboardForm: FC<Props> = ({ onSubmit, onCancel }) => {
  return (
    <Form onSubmit={onSubmit}>
      {({ register, errors }) => (
        <VerticalGroup>
          <Field label="Storyboard title" invalid={!!errors.title} error="Title is required">
            <Input {...register('title', { required: true })} />
          </Field>
          <HorizontalGroup>
            <Button type="submit" icon="plus">
              Create Storyboard
            </Button>
            <Button variant="secondary" icon="x" onClick={() => onCancel()}>
              Cancel
            </Button>
          </HorizontalGroup>
        </VerticalGroup>
      )}
    </Form>
  );
};
