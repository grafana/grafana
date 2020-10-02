import React, { FC, useCallback, useState } from 'react';
import { Button, Field, Form, HorizontalGroup, Input } from '@grafana/ui';

import { RepeatRowSelect } from '../RepeatRowSelect/RepeatRowSelect';

export type OnRowOptionsUpdate = (title: string | null, repeat: string | null | undefined) => void;

export interface Props {
  title: string | null;
  repeat?: string | null;
  onUpdate: OnRowOptionsUpdate;
  onCancel: () => void;
}

export const RowOptionsForm: FC<Props> = ({ repeat, title, onUpdate, onCancel }) => {
  const [newRepeat, setNewRepeat] = useState<string | null | undefined>(repeat);
  const onChangeRepeat = useCallback((name: string) => setNewRepeat(name), [setNewRepeat]);

  return (
    <Form
      defaultValues={{ title }}
      onSubmit={(formData: { title: string | null }) => {
        onUpdate(formData.title, newRepeat);
      }}
    >
      {({ register }) => (
        <>
          <Field label="Title">
            <Input name="title" ref={register} type="text" />
          </Field>

          <Field label="Repeat for">
            <RepeatRowSelect repeat={newRepeat} onChange={onChangeRepeat} />
          </Field>

          <HorizontalGroup>
            <Button type="submit">Update</Button>
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </HorizontalGroup>
        </>
      )}
    </Form>
  );
};
