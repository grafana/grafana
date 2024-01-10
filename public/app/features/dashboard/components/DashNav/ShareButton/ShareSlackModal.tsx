import { css } from '@emotion/css';
import React, { useState } from 'react';

import { Button, Field, Modal, MultiSelect, TextArea, useStyles2 } from '@grafana/ui';

const chanelOptions = [
  { value: 'general', label: 'general' },
  { value: 'grafana', label: 'grafana' },
];
export function ShareSlackModal({ onDismiss }: { onDismiss(): void }) {
  const [value, setValue] = useState<string[]>();

  const styles = useStyles2(getStyles);

  return (
    <Modal className={styles.modal} isOpen title="Share to slack" onDismiss={onDismiss}>
      <div>
        <Field label="Select channel">
          <MultiSelect
            placeholder="Select channel"
            options={chanelOptions}
            value={value}
            onChange={(v) => {
              setValue(v.map((v) => v.value!));
            }}
          />
        </Field>
        <Field label="Description">
          <TextArea placeholder="Type your message" cols={2} />
        </Field>
      </div>
      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline">
          Cancel
        </Button>
        <Button>Share</Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

const getStyles = () => ({
  modal: css({
    width: '500px',
  }),
});
