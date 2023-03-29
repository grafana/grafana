import { css } from '@emotion/css';
import React, { useEffect } from 'react';

import { Stack } from '@grafana/experimental';
import { Button, LoadingPlaceholder, TextArea, useStyles2 } from '@grafana/ui';

import { useDefaultPayloadQuery } from '../../api/templateApi';

export const NO_DEFAULT_PAYLOAD = 'No default payload found';
export const RESET_TO_DEFAULT = 'Reset to default payload';

export function PayloadEditor({
  payload,
  setPayload,
}: {
  payload: string;
  setPayload: React.Dispatch<React.SetStateAction<string>>;
}) {
  const styles = useStyles2(getStyles);
  const { data, isLoading, isError } = useDefaultPayloadQuery();
  const defaultPayload = data?.defaultPayload;
  const onReset = () => {
    setPayload(defaultPayload ?? NO_DEFAULT_PAYLOAD);
  };

  useEffect(() => {
    !isError && defaultPayload && setPayload(defaultPayload);
  }, [defaultPayload, setPayload, isError]);

  useEffect(() => {
    isError && setPayload(NO_DEFAULT_PAYLOAD);
  }, [isError, setPayload]);

  if (isLoading) {
    return <LoadingPlaceholder text={'Loading default payload'} />;
  }

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
