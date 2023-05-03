import React, { useCallback, useState } from 'react';

import { Button, Field, Form, Modal, Input } from '@grafana/ui';

import { RepeatRowSelect } from '../RepeatRowSelect/RepeatRowSelect';

export type OnRowOptionsUpdate = (title: string, repeat?: string | null) => void;

export interface Props {
  title: string;
  repeat?: string | null;
  onUpdate: OnRowOptionsUpdate;
  onCancel: () => void;
}

export const RowOptionsForm = ({ repeat, title, onUpdate, onCancel }: Props) => {
  const [newRepeat, setNewRepeat] = useState<string | null | undefined>(repeat);
  const onChangeRepeat = useCallback((name?: string | null) => setNewRepeat(name), [setNewRepeat]);

  return (
    <Form
      defaultValues={{ title }}
      onSubmit={(formData: { title: string }) => {
        onUpdate(formData.title, newRepeat);
      }}
    >
      {({ register }) => (
        <>
          <Field label="Title">
            <Input {...register('title')} type="text" />
          </Field>

          <Field label="Repeat for">
            <RepeatRowSelect repeat={newRepeat} onChange={onChangeRepeat} />
          </Field>

          <Modal.ButtonRow>
            <Button type="button" variant="secondary" onClick={onCancel} fill="outline">
              Cancel
            </Button>
            <Button type="submit">Update</Button>
          </Modal.ButtonRow>
        </>
      )}
    </Form>
  );
};
