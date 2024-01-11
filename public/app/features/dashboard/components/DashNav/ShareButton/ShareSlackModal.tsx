import { css } from '@emotion/css';
import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { Button, Field, Modal, MultiSelect, TextArea, useStyles2 } from '@grafana/ui';

import { useGetChannelsQuery } from '../../../api/shareToSlackApi';

export function ShareSlackModal({ onDismiss }: { onDismiss(): void }) {
  const [value, setValue] = useState<Array<SelectableValue<string>>>([]);
  const { data: channels, isLoading } = useGetChannelsQuery();

  const styles = useStyles2(getStyles);

  return (
    <Modal className={styles.modal} isOpen title="Share to slack" onDismiss={onDismiss}>
      <div>
        <Field label="Select channel">
          <MultiSelect
            isLoading={isLoading}
            placeholder="Select channel"
            options={channels}
            value={value}
            onChange={(v) => {
              setValue(v);
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
