import React from 'react';

import { Button, Form, Input, Modal, TextArea } from '@grafana/ui';
import { Field } from '@grafana/ui/';

import { ExploreWorkspaceSnapshot } from '../types';

type Props = {
  onSave: (workspace: Pick<ExploreWorkspaceSnapshot, 'name' | 'description'>) => void;
  onCancel: () => void;
};

type FormDTO = {
  name: string;
  description: string;
};

type ModalProps = {
  isOpen: boolean;
} & Props;

export const NewExploreWorkspaceSnapshotFormModal = (props: ModalProps) => {
  return (
    <Modal isOpen={props.isOpen} title="New Snapshot" onDismiss={props.onCancel}>
      <Form onSubmit={(data: FormDTO) => props.onSave(data)}>
        {({ register }) => {
          return (
            <>
              <Field label="Name">
                <Input placeholder="Snaphost name..." {...register('name')}></Input>
              </Field>

              <Field label="Description">
                <TextArea placeholder="Snapshot description..." {...register('description')}></TextArea>
              </Field>

              <Modal.ButtonRow>
                <Button variant="secondary" onClick={props.onCancel}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Save
                </Button>
              </Modal.ButtonRow>
            </>
          );
        }}
      </Form>
    </Modal>
  );
};
