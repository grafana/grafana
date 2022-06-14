import React, { ReactElement } from 'react';

import { DataSourceSettings } from '@grafana/data';
import { Button, Field, FieldSet, Input, Modal } from '@grafana/ui';

interface Props {
  dataSource: DataSourceSettings;
  onDismiss: () => void;
}

export function ChangeUIDModal({ onDismiss, dataSource }: Props): ReactElement {
  return (
    <Modal title="Change data source identifier (uid)" icon="exclamation-triangle" onDismiss={onDismiss} isOpen={true}>
      <FieldSet>
        <Field label="Current uid">
          <Input value={dataSource.uid} readOnly disabled />
        </Field>
        <Field label="New uid">
          <Input defaultValue={dataSource.uid} />
        </Field>
        {/* <Button>List all current references</Button> */}
      </FieldSet>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          Cancel
        </Button>
        <Button variant="destructive" onClick={onDismiss}>
          Change
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
