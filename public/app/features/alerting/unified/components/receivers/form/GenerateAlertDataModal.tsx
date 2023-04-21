import { css } from '@emotion/css';
import pluralize from 'pluralize';
import React, { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Button, Card, Modal, useStyles2 } from '@grafana/ui';
import { TestReceiversAlert } from 'app/plugins/datasource/alertmanager/types';

import AnnotationsField from '../../rule-editor/AnnotationsField';
import LabelsField from '../../rule-editor/LabelsField';

interface Props {
  isOpen: boolean;
  onDismiss: () => void;
  onAccept: (alerts: TestReceiversAlert[]) => void;
}

type AnnoField = {
  key: string;
  value: string;
};

interface FormFields {
  annotations: AnnoField[];
  labels: AnnoField[];
}

const defaultValues: FormFields = {
  annotations: [{ key: '', value: '' }],
  labels: [{ key: '', value: '' }],
};

export const GenerateAlertDataModal = ({ isOpen, onDismiss, onAccept }: Props) => {
  const styles = useStyles2(getStyles);
  const formMethods = useForm<FormFields>({ defaultValues, mode: 'onBlur' });
  const [alerts, setAlerts] = useState<TestReceiversAlert[]>([]);
  const annotations = formMethods.watch('annotations');
  const labels = formMethods.watch('labels');

  const onAdd = () => {
    const alert: TestReceiversAlert = {
      annotations: annotations
        .filter(({ key, value }) => !!key && !!value)
        .reduce((acc, { key, value }) => {
          return { ...acc, [key]: value };
        }, {}),
      labels: labels
        .filter(({ key, value }) => !!key && !!value)
        .reduce((acc, { key, value }) => {
          return { ...acc, [key]: value };
        }, {}),
    };
    setAlerts((alerts) => [...alerts, alert]);
    formMethods.reset();
  };

  const onSubmit = () => {
    onAccept(alerts);
    setAlerts([]);
  };

  return (
    <Modal onDismiss={onDismiss} isOpen={isOpen} title={'Generate alert data'}>
      <FormProvider {...formMethods}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <>
            <div className={styles.section}>
              You have created {alerts.length} {pluralize('alert', alerts.length)} in the list.
            </div>
            <Card>
              <Stack direction="column">
                <div className={styles.section}>
                  <AnnotationsField />
                </div>
                <div className={styles.section}>
                  <LabelsField />
                </div>
                {(annotations.length > 0 || labels.length > 0) && (
                  <Button
                    onClick={onAdd}
                    className={styles.button}
                    icon="plus-circle"
                    type="button"
                    variant="secondary"
                  >
                    Add alert
                  </Button>
                )}
              </Stack>
            </Card>
          </>
          {alerts.length > 0 && (
            <Modal.ButtonRow>
              <Button onClick={onSubmit}>Add this alert list</Button>
            </Modal.ButtonRow>
          )}
        </form>
      </FormProvider>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  section: css`
    margin-bottom: ${theme.spacing(2)};
  `,
  button: css`
    flex: none;
    width: fit-content;
    padding-right: ${theme.spacing(1)};
  `,
});
