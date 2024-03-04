import React from 'react';

import { Button, Form, Input, Modal, TextArea } from '@grafana/ui';
import { Field } from '@grafana/ui/';

import { ExploreWorkspace } from '../types';

type Props = {
  onSave: (workspace: Pick<ExploreWorkspace, 'name' | 'description'>) => void;
  onCancel: () => void;
};

type FormDTO = {
  name: string;
  description: string;
};

type ModalProps = {
  isOpen: boolean;
} & Props;

export const NewExploreWorkspaceFormModal = (props: ModalProps) => {
  return (
    <Modal isOpen={props.isOpen} title="New Workspace" onDismiss={props.onCancel}>
      <Form onSubmit={(data: FormDTO) => props.onSave(data)}>
        {({ register }) => {
          return (
            <>
              <Field label="Name">
                <Input placeholder="Workspace name..." {...register('name')}></Input>
              </Field>

              <Field label="Description">
                <TextArea placeholder="Workspace description..." {...register('description')}></TextArea>
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
