import { css } from '@emotion/css';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Label, Modal, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { TestReceiversAlert } from 'app/plugins/datasource/alertmanager/types';
import { Annotations, Labels } from 'app/types/unified-alerting-dto';

import { defaultAnnotations } from '../../../utils/constants';
import AnnotationsStep from '../../rule-editor/AnnotationsStep';
import LabelsField from '../../rule-editor/labels/LabelsField';

interface Props {
  isOpen: boolean;
  onDismiss: () => void;
  onTest: (alert?: TestReceiversAlert) => void;
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

export const TestContactPointModal = ({ isOpen, onDismiss, onTest }: Props) => {
  const [notificationType, setNotificationType] = useState<NotificationType>(NotificationType.predefined);
  const styles = useStyles2(getStyles);
  const formMethods = useForm<FormFields>({ defaultValues, mode: 'onBlur' });

  const onSubmit = (data: FormFields) => {
    if (notificationType === NotificationType.custom) {
      const alert = {
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
      onTest(alert);
    } else {
      onTest();
    }
  };

  return (
    <Modal
      onDismiss={onDismiss}
      isOpen={isOpen}
      title={t('alerting.test-contact-point-modal.title-test-contact-point', 'Test contact point')}
    >
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
            <Button type="submit">
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
