import { css } from '@emotion/css';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Label, Modal, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { GrafanaManagedContactPoint, GrafanaManagedReceiverConfig } from 'app/plugins/datasource/alertmanager/types';

import { useTestContactPoint } from '../../../hooks/useTestContactPoint';
import { GrafanaChannelValues } from '../../../types/receiver-form';
import { defaultAnnotations } from '../../../utils/constants';
import { stringifyErrorLike } from '../../../utils/misc';
import AnnotationsStep from '../../rule-editor/AnnotationsStep';
import LabelsField from '../../rule-editor/labels/LabelsField';

interface Props {
  isOpen: boolean;
  onDismiss: () => void;
  contactPoint?: GrafanaManagedContactPoint;
  channelValues: GrafanaChannelValues;
  existingIntegration?: GrafanaManagedReceiverConfig;
  defaultChannelValues: GrafanaChannelValues;
}

type AnnoField = {
  key: string;
  value: string;
};

interface FormFields {
  annotations: AnnoField[];
  labels: AnnoField[];
}

enum NotificationType {
  predefined = 'Predefined',
  custom = 'Custom',
}

const notificationOptions = Object.values(NotificationType).map((value) => ({ label: value, value: value }));

const defaultValues: FormFields = {
  annotations: [...defaultAnnotations],
  labels: [{ key: '', value: '' }],
};

export const TestContactPointModal = ({
  isOpen,
  onDismiss,
  contactPoint,
  channelValues,
  existingIntegration,
  defaultChannelValues,
}: Props) => {
  const [notificationType, setNotificationType] = useState<NotificationType>(NotificationType.predefined);
  const [testError, setTestError] = useState<unknown>(null);
  const [testSuccess, setTestSuccess] = useState(false);
  const styles = useStyles2(getStyles);
  const formMethods = useForm<FormFields>({ defaultValues, mode: 'onBlur' });
  const {
    testChannel,
    isLoading,
    error: apiError,
    isSuccess: apiSuccess,
  } = useTestContactPoint({
    contactPoint,
    defaultChannelValues,
  });

  // Combine RTK Query errors with errors thrown by testChannel
  const error = testError || apiError;
  const isSuccess = !error && (testSuccess || apiSuccess);

  const onSubmit = async (data: FormFields) => {
    setTestError(null);
    setTestSuccess(false);

    const alert =
      notificationType === NotificationType.custom
        ? {
            annotations: data.annotations
              .filter(({ key, value }) => !!key && !!value)
              .reduce<Record<string, string>>((acc, { key, value }) => ({ ...acc, [key]: value }), {}),
            labels: data.labels
              .filter(({ key, value }) => !!key && !!value)
              .reduce<Record<string, string>>((acc, { key, value }) => ({ ...acc, [key]: value }), {}),
          }
        : undefined;

    try {
      await testChannel({
        channelValues,
        existingIntegration,
        alert,
      });
      setTestSuccess(true);
    } catch (err) {
      setTestError(err);
    }
  };

  return (
    <Modal
      onDismiss={onDismiss}
      isOpen={isOpen}
      title={t('alerting.test-contact-point-modal.title-test-contact-point', 'Test contact point')}
    >
      {Boolean(error) && (
        <Alert title={t('alerting.test-contact-point-modal.test-failed', 'Test notification failed')} severity="error">
          {stringifyErrorLike(error)}
        </Alert>
      )}

      {isSuccess && (
        <Alert
          title={t('alerting.test-contact-point-modal.test-successful', 'Test notification sent successfully')}
          severity="success"
        />
      )}

      <div className={styles.section}>
        <Label>
          <Trans i18nKey="alerting.test-contact-point-modal.notification-message">Notification message</Trans>
        </Label>
        <RadioButtonGroup
          options={notificationOptions}
          value={notificationType}
          onChange={(value) => setNotificationType(value)}
        />
      </div>

      <FormProvider {...formMethods}>
        <form onSubmit={formMethods.handleSubmit(onSubmit)}>
          {notificationType === NotificationType.predefined && (
            <div className={styles.section}>
              <Trans i18nKey="alerting.test-contact-point-modal.predefined-notification-message">
                You will send a test notification that uses a predefined alert. If you have defined a custom template or
                message, for better results switch to <strong>custom</strong> notification message, from above.
              </Trans>
            </div>
          )}
          {notificationType === NotificationType.custom && (
            <>
              <div className={styles.section}>
                <Trans i18nKey="alerting.test-contact-point-modal.custom-notification-message">
                  You will send a test notification that uses the annotations defined below. This is a good option if
                  you use custom templates and messages.
                </Trans>
              </div>
              <div className={styles.section}>
                <AnnotationsStep />
              </div>
              <div className={styles.section}>
                <LabelsField />
              </div>
            </>
          )}

          <Modal.ButtonRow>
            <Button type="submit" disabled={isLoading}>
              <Trans i18nKey="alerting.test-contact-point-modal.send-test-notification">Send test notification</Trans>
            </Button>
          </Modal.ButtonRow>
        </form>
      </FormProvider>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  flexRow: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing(1),
  }),
  section: css({
    marginBottom: theme.spacing(2),
  }),
});
