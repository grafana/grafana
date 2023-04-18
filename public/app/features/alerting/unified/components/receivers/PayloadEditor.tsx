import { css } from '@emotion/css';
import React from 'react';

import { Stack } from '@grafana/experimental';
import { Button, TextArea, useStyles2 } from '@grafana/ui';

export const RESET_TO_DEFAULT = 'Reset to default payload';

export function PayloadEditor({
  payload,
  setPayload,
  defaultPayload,
}: {
  payload: string;
  defaultPayload: string;
  setPayload: React.Dispatch<React.SetStateAction<string>>;
}) {
  const styles = useStyles2(getStyles);
  const onReset = () => {
    setPayload(defaultPayload);
  };

  return (
    <Stack direction="row" alignItems="center">
      <div>
        <Stack direction="column" gap={1}>
          <h5> Payload</h5>
          <TextArea
            required={true}
            value={payload}
            onChange={(e) => {
              setPayload(e.currentTarget.value);
            }}
            data-testid="payloadJSON"
            className={styles.jsonEditor}
            rows={10}
            cols={50}
          />
          <Button onClick={onReset} className={styles.button}>
            {RESET_TO_DEFAULT}
          </Button>
        </Stack>
      </div>
    </Stack>
  );
}

const getStyles = () => ({
  jsonEditor: css`
    width: 605px;
    height: 291px;
  `,
  button: css`
    flex: none;
    width: fit-content;
  `,
});
