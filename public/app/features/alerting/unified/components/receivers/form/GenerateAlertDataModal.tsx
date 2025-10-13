import { css } from '@emotion/css';
import { addDays, subDays } from 'date-fns';
import { uniqueId } from 'lodash';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Card, Modal, RadioButtonGroup, Stack, useStyles2 } from '@grafana/ui';
import { TestTemplateAlert } from 'app/plugins/datasource/alertmanager/types';

import { KeyValueField } from '../../../api/templateApi';
import AnnotationsStep from '../../rule-editor/AnnotationsStep';
import LabelsField from '../../rule-editor/labels/LabelsField';

interface Props {
  isOpen: boolean;
  onDismiss: () => void;
  onAccept: (alerts: TestTemplateAlert[]) => void;
}

interface FormFields {
  annotations: KeyValueField[];
  labels: KeyValueField[];
  status: 'firing' | 'resolved';
}

const defaultValues: FormFields = {
  annotations: [{ key: '', value: '' }],
  labels: [{ key: '', value: '' }],
  status: 'firing',
};

export const GenerateAlertDataModal = ({ isOpen, onDismiss, onAccept }: Props) => {
  const styles = useStyles2(getStyles);

  const [alerts, setAlerts] = useState<TestTemplateAlert[]>([]);

  const formMethods = useForm<FormFields>({ defaultValues, mode: 'onBlur' });
  const annotations = formMethods.watch('annotations');
  const labels = formMethods.watch('labels');
  const [status, setStatus] = useState<'firing' | 'resolved'>('firing');

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
      endsAt: status === 'firing' ? addDays(new Date(), 1).toISOString() : subDays(new Date(), 1).toISOString(),
      status,
      fingerprint: uniqueId('fingerprint_'),
    };
    setAlerts((alerts) => [...alerts, alert]);
    formMethods.reset();
  };

  const onSubmit = () => {
    onAccept(alerts);
    setAlerts([]);
    formMethods.reset();
    setStatus('firing');
  };

  const labelsOrAnnotationsAdded = () => {
    const someLabels = labels.some((lb) => lb.key !== '' && lb.value !== '');
    const someAnnotations = annotations.some((ann) => ann.key !== '' && ann.value !== '');
    return someLabels || someAnnotations;
  };

  type AlertOption = {
    label: string;
    value: 'firing' | 'resolved';
  };
  const alertOptions: AlertOption[] = [
    {
      label: 'Firing',
      value: 'firing',
    },
    { label: 'Resolved', value: 'resolved' },
  ];

  return (
    <Modal onDismiss={onDismiss} isOpen={isOpen} title={'Add custom alerts'}>
      <FormProvider {...formMethods}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            formMethods.reset();
            setStatus('firing');
          }}
        >
          <>
            <Card>
              <Stack direction="column" gap={1}>
                <div className={styles.section}>
                  <AnnotationsStep />
                </div>
                <div className={styles.section}>
                  <LabelsField />
                </div>
                <div className={styles.flexWrapper}>
                  <RadioButtonGroup value={status} options={alertOptions} onChange={(value) => setStatus(value)} />
                  <Button
                    onClick={onAdd}
                    className={styles.onAddButton}
                    icon="plus-circle"
                    type="button"
                    variant="secondary"
                    disabled={!labelsOrAnnotationsAdded()}
                  >
                    Add alert data
                  </Button>
                </div>
              </Stack>
            </Card>
          </>
          <div className={styles.onSubmitWrapper} />
          {alerts.length > 0 && (
            <Stack direction="column" gap={1}>
              <h5> Review alert data to add to the payload:</h5>
              <pre className={styles.result} data-testid="payloadJSON">
                {JSON.stringify(alerts, null, 2)}
              </pre>
            </Stack>
          )}
          <div className={styles.onSubmitWrapper}>
            <Modal.ButtonRow>
              <Button onClick={onSubmit} disabled={alerts.length === 0} className={styles.onSubmitButton}>
                Add alert data to payload
              </Button>
            </Modal.ButtonRow>
          </div>
        </form>
      </FormProvider>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  section: css({
    marginBottom: theme.spacing(2),
  }),
  onAddButton: css({
    flex: 'none',
    width: 'fit-content',
    paddingRight: theme.spacing(1),
    marginLeft: 'auto',
  }),
  flexWrapper: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  }),
  onSubmitWrapper: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
  }),
  onSubmitButton: css({
    marginLeft: theme.spacing(2),
  }),
  result: css({
    width: '570px',
    height: '363px',
  }),
});
