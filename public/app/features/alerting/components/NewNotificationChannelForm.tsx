import React, { FC, useEffect } from 'react';
import { css } from 'emotion';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import {
  Button,
  Field,
  FormAPI,
  HorizontalGroup,
  InfoBox,
  Input,
  InputControl,
  Select,
  stylesFactory,
  Switch,
  useTheme,
} from '@grafana/ui';
import { OptionElement } from './OptionElement';
import { NotificationChannel, NotificationChannelDTO, Option } from '../../../types';

interface Props extends Omit<FormAPI<NotificationChannelDTO>, 'formState'> {
  selectableChannels: Array<SelectableValue<string>>;
  selectedChannel: NotificationChannel;
  imageRendererAvailable: boolean;

  onTestChannel: (data: NotificationChannelDTO) => void;
}

export const NewNotificationChannelForm: FC<Props> = ({
  control,
  errors,
  selectedChannel,
  selectableChannels,
  register,
  watch,
  getValues,
  imageRendererAvailable,
  onTestChannel,
}) => {
  const styles = getStyles(useTheme());

  useEffect(() => {
    watch(['type', 'settings.priority', 'sendReminder', 'uploadImage']);
  }, []);

  return (
    <>
      <div className={styles.basicSettings}>
        <Field label="Name" invalid={!!errors.name} error={errors.name && errors.name.message}>
          <Input name="name" ref={register({ required: 'Name is required' })} />
        </Field>
        <Field label="Type">
          <InputControl
            name="type"
            as={Select}
            options={selectableChannels}
            control={control}
            rules={{ required: true }}
          />
        </Field>
        <Field label="Default" description="Use this notification for all alerts">
          <Switch name="isDefault" ref={register} />
        </Field>
        <Field label="Include image" description="Captures an image and include it in the notification">
          <Switch name="settings.uploadImage" ref={register} />
        </Field>
        {getValues().uploadImage && !imageRendererAvailable && (
          <InfoBox title="No image renderer available/installed">
            Grafana cannot find an image renderer to capture an image for the notification. Please make sure the Grafana
            Image Renderer plugin is installed. Please contact your Grafana administrator to install the plugin.
          </InfoBox>
        )}
        <Field
          label="Disable Resolve Message"
          description="Disable the resolve message [OK] that is sent when alerting state returns to false"
        >
          <Switch name="disableResolveMessage" ref={register} />
        </Field>
        <Field label="Send reminders" description="Send additional notifications for triggered alerts">
          <Switch name="sendReminder" ref={register} />
        </Field>
        {getValues().sendReminder && (
          <>
            <Field
              label="Send reminder every"
              description="Specify how often reminders should be sent, e.g. every 30s, 1m, 10m, 30m or 1h etc."
            >
              <Input name="frequency" ref={register} />
            </Field>
            <InfoBox>
              Alert reminders are sent after rules are evaluated. Therefore a reminder can never be sent more frequently
              than a configured alert rule evaluation interval.
            </InfoBox>
          </>
        )}
      </div>
      {selectedChannel && (
        <>
          <h3>{selectedChannel.heading}</h3>
          {selectedChannel.options.map((option: Option, index: number) => {
            const key = `${option.label}-${index}`;

            // Some options can be dependent on other options, this determines what is selected in the dependency options
            // I think this needs more thought.
            const selectedOptionValue =
              getValues()[`settings.${option.show.field}`] &&
              (getValues()[`settings.${option.show.field}`] as SelectableValue<string>).value;

            if (option.show.field && selectedOptionValue !== option.show.is) {
              return null;
            }

            return (
              <Field
                key={key}
                label={option.label}
                description={option.description}
                invalid={errors.settings && !!errors.settings[option.modelValue]}
                error={
                  errors.settings && errors.settings[option.modelValue] && errors.settings[option.modelValue].message
                }
              >
                <OptionElement option={option} register={register} control={control} />
              </Field>
            );
          })}
        </>
      )}
      <HorizontalGroup>
        <Button type="submit">Save</Button>
        <Button type="button" variant="secondary" onClick={() => onTestChannel(getValues({ nest: true }))}>
          Test
        </Button>
        <Button type="button" variant="secondary">
          Back
        </Button>
      </HorizontalGroup>
    </>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    basicSettings: css`
      margin-bottom: ${theme.spacing.xl};
    `,
  };
});
