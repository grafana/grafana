import { css } from '@emotion/css';
import { useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Label, Modal, RadioButtonGroup, Text, useStyles2 } from '@grafana/ui';
import { Receiver, TestReceiversAlert } from 'app/plugins/datasource/alertmanager/types';
import { Annotations, Labels } from 'app/types/unified-alerting-dto';

import { useTestIntegrationMutation } from '../../../api/receiversApi';
import { GrafanaChannelValues } from '../../../types/receiver-form';
import { defaultAnnotations } from '../../../utils/constants';
import { stringifyErrorLike } from '../../../utils/misc';
import AnnotationsStep from '../../rule-editor/AnnotationsStep';
import LabelsField from '../../rule-editor/labels/LabelsField';

interface Props {
  isOpen: boolean;
  onDismiss: () => void;
  alertManagerSourceName: string;
  receivers: Receiver[];
  channelValues?: GrafanaChannelValues;
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
  alertManagerSourceName,
  receivers,
  channelValues,
}: Props) => {
  const [notificationType, setNotificationType] = useState<NotificationType>(NotificationType.predefined);
  const styles = useStyles2(getStyles);
  const formMethods = useForm<FormFields>({ defaultValues, mode: 'onBlur' });
  const [testIntegration, { isLoading, error, isSuccess }] = useTestIntegrationMutation();

  // Check if email integration has placeholder addresses
  const hasPlaceholderEmail = useMemo(() => {
    if (!channelValues || channelValues.type !== 'email') {
      return false;
    }
    const addresses = channelValues.settings?.addresses;
    if (!addresses) {
      return false;
    }
    const placeholders = ['<example@email.com>', 'example@email.com'];
    const addressList = typeof addresses === 'string' ? [addresses] : addresses;
    return addressList.some((addr: string) => placeholders.includes(addr?.trim()));
  }, [channelValues]);

  const onSubmit = async (data: FormFields) => {
    let alert: TestReceiversAlert | undefined;
    if (notificationType === NotificationType.custom) {
      alert = {
        annotations: data.annotations
          .filter(({ key, value }) => !!key && !!value)
          .reduce<Annotations>((acc, { key, value }) => {
            return { ...acc, [key]: value };
          }, {}),
        labels: data.labels
          .filter(({ key, value }) => !!key && !!value)
          .reduce<Labels>((acc, { key, value }) => {
            return { ...acc, [key]: value };
          }, {}),
      };
    }

    await testIntegration({
      alertManagerSourceName,
      receivers,
      alert,
    }).unwrap();
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

      {hasPlaceholderEmail && (
        <div className={styles.section}>
          <Alert
            title={t(
              'alerting.test-contact-point-modal.placeholder-warning-title',
              'Configure a valid email address'
            )}
            severity="info"
          >
            <Trans i18nKey="alerting.test-contact-point-modal.placeholder-warning-body">
              This contact point is using a placeholder email address (<Text variant="code">example@email.com</Text>).
              Please update it with a valid email address before testing.
            </Trans>
          </Alert>
        </div>
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
            <Button
              type="submit"
              disabled={isLoading || hasPlaceholderEmail}
              tooltip={
                hasPlaceholderEmail
                  ? t(
                      'alerting.test-contact-point-modal.test-disabled-placeholder',
                      'Please configure a valid email address before testing'
                    )
                  : undefined
              }
            >
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
