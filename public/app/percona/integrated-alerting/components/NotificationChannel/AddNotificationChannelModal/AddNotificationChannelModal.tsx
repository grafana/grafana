import React, { FC, useContext } from 'react';
import { withTypes, Field } from 'react-final-form';
import { HorizontalGroup, Button } from '@grafana/ui';
import { AppEvents } from '@grafana/data';
import { Modal, LoaderButton, TextInputField, validators, logger } from '@percona/platform-core';
import { appEvents } from 'app/core/core';
import { SelectField } from 'app/percona/shared/components/Form/SelectField';
import { NotificationChannelProvider } from '../NotificationChannel.provider';
import {
  NotificationChannelRenderProps,
  NotificationChannelType,
  PagerDutyKeyType,
} from '../NotificationChannel.types';
import { AddNotificationChannelModalProps } from './AddNotificationChannelModal.types';
import { Messages } from './AddNotificationChannelModal.messages';
import { TYPE_OPTIONS } from './AddNotificationChannel.constants';
import { NotificationChannelService } from '../NotificationChannel.service';
import { getInitialValues } from './AddNotificationChannelModal.utils';
import { EmailFields } from './EmailFields/EmailFields';
import { SlackFields } from './SlackFields/SlackFields';
import { PagerDutyFields } from './PagerDutyFields/PagerDutyFields';
import { WebHookFields } from './WebHookFields/WebHookFields';

const { required } = validators;
// Our "values" typings won't be right without using this
const { Form } = withTypes<NotificationChannelRenderProps>();

const TypeField: FC<{ values: NotificationChannelRenderProps }> = ({ values }) => {
  const { type } = values;

  switch (type?.value) {
    case NotificationChannelType.email:
      return <EmailFields />;
    case NotificationChannelType.pagerDuty:
      return <PagerDutyFields values={values} />;
    case NotificationChannelType.slack:
      return <SlackFields />;
    case NotificationChannelType.webhook:
      return <WebHookFields values={values} />;
    default:
      return null;
  }
};

export const AddNotificationChannelModal: FC<AddNotificationChannelModalProps> = ({
  isVisible,
  notificationChannel,
  setVisible,
}) => {
  const initialValues = notificationChannel ? getInitialValues(notificationChannel) : {};
  const { getNotificationChannels } = useContext(NotificationChannelProvider);
  const onSubmit = async (values: NotificationChannelRenderProps) => {
    const submittedValues = { ...values };

    if (submittedValues.keyType === PagerDutyKeyType.routing) {
      submittedValues.service = '';
    } else {
      submittedValues.routing = '';
    }

    if (!submittedValues.useWebhookTls) {
      submittedValues.ca = undefined;
      submittedValues.cert = undefined;
      submittedValues.key = undefined;
      submittedValues.serverName = undefined;
      submittedValues.skipVerify = undefined;
    }

    try {
      if (notificationChannel) {
        await NotificationChannelService.change(notificationChannel.channelId as string, submittedValues);
      } else {
        await NotificationChannelService.add(submittedValues);
      }
      setVisible(false);
      appEvents.emit(AppEvents.alertSuccess, [notificationChannel ? Messages.editSuccess : Messages.addSuccess]);
      getNotificationChannels();
    } catch (e) {
      logger.error(e);
    }
  };

  return (
    <Modal title={Messages.title} isVisible={isVisible} onClose={() => setVisible(false)}>
      <Form
        initialValues={initialValues}
        onSubmit={onSubmit}
        render={({ handleSubmit, valid, pristine, submitting, values }) => (
          <form onSubmit={handleSubmit}>
            <>
              <Field name="type">
                {({ input }) => <SelectField label={Messages.fields.type} options={TYPE_OPTIONS} {...input} />}
              </Field>
              <TextInputField name="name" label={Messages.fields.name} validators={[required]} />
              <TypeField values={values} />
              <HorizontalGroup justify="center" spacing="md">
                <LoaderButton
                  data-testid="notification-channel-add-button"
                  size="md"
                  variant="primary"
                  disabled={!valid || pristine}
                  loading={submitting}
                >
                  {notificationChannel ? Messages.editAction : Messages.addAction}
                </LoaderButton>
                <Button
                  data-testid="notification-channel-cancel-button"
                  variant="secondary"
                  onClick={() => setVisible(false)}
                >
                  {Messages.cancelAction}
                </Button>
              </HorizontalGroup>
            </>
          </form>
        )}
      />
    </Modal>
  );
};
