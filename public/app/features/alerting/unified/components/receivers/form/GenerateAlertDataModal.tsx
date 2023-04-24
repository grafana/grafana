import { css } from '@emotion/css';
import addDays from 'date-fns/addDays';
import pluralize from 'pluralize';
import React, { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Button, Card, Checkbox, Modal, useStyles2 } from '@grafana/ui';
import { TestTemplateAlert } from 'app/plugins/datasource/alertmanager/types';

import AnnotationsField from '../../rule-editor/AnnotationsField';
import LabelsField from '../../rule-editor/LabelsField';

interface Props {
  isOpen: boolean;
  onDismiss: () => void;
  onAccept: (alerts: TestTemplateAlert[]) => void;
}

type AnnoField = {
  key: string;
  value: string;
};

interface FormFields {
  annotations: AnnoField[];
  labels: AnnoField[];
  firing: boolean;
}

const defaultValues: FormFields = {
  annotations: [{ key: '', value: '' }],
  labels: [{ key: '', value: '' }],
  firing: true,
};

export const GenerateAlertDataModal = ({ isOpen, onDismiss, onAccept }: Props) => {
  const styles = useStyles2(getStyles);
  const formMethods = useForm<FormFields>({ defaultValues, mode: 'onBlur' });
  const [alerts, setAlerts] = useState<TestTemplateAlert[]>([]);
  const annotations = formMethods.watch('annotations');
  const labels = formMethods.watch('labels');
  const firing = formMethods.watch('firing');

  const onAdd = () => {
    const alert: TestTemplateAlert = {
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
      startsAt: '2023-04-01T00:00:00Z',
      endsAt: firing ? addDays(new Date(), 2).toISOString() : '2023-12-01T00:05:00Z',
    };
    setAlerts((alerts) => [...alerts, alert]);
    formMethods.reset();
  };

  const onSubmit = () => {
    onAccept(alerts);
    setAlerts([]);
  };

  const labelsOrAnnotationsAdded =
    (labels[0]?.key !== '' && labels[0]?.value !== '') || (annotations[0]?.key !== '' && annotations[0]?.value !== '');

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
            <Card>
              <Stack direction="column" gap={1}>
                <div className={styles.section}>
                  <AnnotationsField />
                </div>
                <div className={styles.section}>
                  <LabelsField />
                </div>
                <div className={styles.flexWrapper}>
                  <Checkbox
                    {...formMethods.register('firing')}
                    label="Firing"
                    description="Creates a firing alert in case of checked."
                  />
                  <Button
                    onClick={onAdd}
                    className={styles.onAddButton}
                    icon="plus-circle"
                    type="button"
                    variant="secondary"
                    disabled={!labelsOrAnnotationsAdded}
                  >
                    Add alert
                  </Button>
                </div>
              </Stack>
            </Card>
          </>
          <div className={styles.onSubmitWrapper}>
            <div className={styles.section}>
              You have created {alerts.length} {pluralize('alert', alerts.length)} in the list.
            </div>
            <Modal.ButtonRow>
              <Button onClick={onSubmit} disabled={alerts.length === 0} className={styles.onSubmitButton}>
                Add this alert list
              </Button>
            </Modal.ButtonRow>
          </div>
        </form>
      </FormProvider>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  section: css`
    margin-bottom: ${theme.spacing(2)};
  `,
  onAddButton: css`
    flex: none;
    width: fit-content;
    padding-right: ${theme.spacing(1)};
    margin-left: auto;
  `,
  flexWrapper: css`
    display: flex;
    flex-direction: row,
    justify-content: space-between;
  `,
  onSubmitWrapper: css`
    display: flex;
    flex-direction: row;
    align-items: baseline;
    justify-content: flex-end;
  `,
  onSubmitButton: css`
    margin-left: ${theme.spacing(2)};
  `,
});
