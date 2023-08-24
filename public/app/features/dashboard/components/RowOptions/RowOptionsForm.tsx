import React, { useCallback, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Button, Field, Form, Modal, Input, Alert } from '@grafana/ui';

import { RepeatRowSelect } from '../RepeatRowSelect/RepeatRowSelect';

export type OnRowOptionsUpdate = (title: string, repeat?: string | null) => void;

export interface Props {
  title: string;
  repeat?: string | null;
  onUpdate: OnRowOptionsUpdate;
  onCancel: () => void;
  warningMessage?: string;
}

export const RowOptionsForm = ({ repeat, title, warningMessage, onUpdate, onCancel }: Props) => {
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
          {warningMessage && (
            <Alert
              data-testid={selectors.pages.Dashboard.Rows.Repeated.ConfigSection.warningMessage}
              severity="warning"
              title=""
              topSpacing={3}
              bottomSpacing={0}
            >
              {warningMessage}
            </Alert>
          )}
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
