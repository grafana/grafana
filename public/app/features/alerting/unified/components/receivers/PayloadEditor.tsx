import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Button, TextArea, useStyles2 } from '@grafana/ui';
import { TestTemplateAlert } from 'app/plugins/datasource/alertmanager/types';

import { GenerateAlertDataModal } from './form/GenerateAlertDataModal';

export const RESET_TO_DEFAULT = 'Reset to default';

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

  const [isEditingAlertData, setIsEditingAlertData] = useState(false);

  const onCloseEditAlertModal = () => {
    setIsEditingAlertData(false);
  };

  const onOpenEditAlertModal = () => setIsEditingAlertData(true);

  const onAddAlertList = (alerts: TestTemplateAlert[]) => {
    onCloseEditAlertModal();
    setPayload((payload) => {
      const payloadObj = JSON.parse(payload);
      return JSON.stringify([...payloadObj, ...alerts], undefined, 2);
    });
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
          <Stack>
            <Button onClick={onReset} className={styles.button} icon="arrow-left" type="button" variant="secondary">
              {RESET_TO_DEFAULT}
            </Button>
            <Button
              onClick={onOpenEditAlertModal}
              className={styles.button}
              icon="plus-circle"
              type="button"
              variant="secondary"
            >
              Add alert data
            </Button>
          </Stack>
        </Stack>
        <GenerateAlertDataModal
          isOpen={isEditingAlertData}
          onDismiss={onCloseEditAlertModal}
          onAccept={onAddAlertList}
        />
      </div>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  jsonEditor: css`
    width: 605px;
    height: 291px;
  `,
  button: css`
    flex: none;
    width: fit-content;
    padding-right: ${theme.spacing(1)};
  `,
});
