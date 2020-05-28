import React, { FC, useEffect } from 'react';
import { css } from 'emotion';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import {
  Button,
  Field,
  FormAPI,
  FormsOnSubmit,
  HorizontalGroup,
  Input,
  InputControl,
  Select,
  stylesFactory,
  Switch,
  useTheme,
} from '@grafana/ui';
import { NotificationChannel, Option } from '../../../types';
import { OptionElement } from './OptionElement';

type OptionSwitch = { label: string; name: string; description: string };

interface Props extends Omit<FormAPI<any>, 'formState'> {
  selectableChannels: Array<SelectableValue<string>>;
  selectedChannel: NotificationChannel;

  onSubmit: FormsOnSubmit<any>;
}

export const NewNotificationChannelForm: FC<Props> = ({
  control,
  errors,
  onSubmit,
  selectedChannel,
  selectableChannels,
  register,
  watch,
  getValues,
}) => {
  const styles = getStyles(useTheme());
  useEffect(() => {
    watch('type');
  }, []);
  console.log(getValues());
  return (
    <>
      <div className={styles.basicSettings}>
        <Field label="Name" invalid={!!errors.name} error={errors.name}>
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
        {switches.map((item: OptionSwitch, index: number) => {
          return (
            <Field label={item.label} description={item.description} key={`${item.name}-${index}`}>
              <Switch name={`${item.name}`} ref={register} />
            </Field>
          );
        })}
      </div>
      {selectedChannel && (
        <>
          <h3>{selectedChannel.heading}</h3>
          {selectedChannel.options.map((option: Option, index: number) => {
            return (
              <Field key={`${option.label}-${index}`} label={option.label} description={option.description}>
                <OptionElement option={option} register={register} control={control} />
              </Field>
            );
          })}
        </>
      )}
      <HorizontalGroup>
        <Button type="submit" onClick={onSubmit}>
          Save
        </Button>
        <Button type="button" variant="secondary">
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

const switches: OptionSwitch[] = [
  {
    label: 'Default',
    description: 'Use this notification for all alerts',
    name: 'isDefault',
  },
  {
    label: 'Include image',
    description: 'Captures an image and include it in the notification',
    name: 'uploadImage',
  },
  {
    label: 'Disable Resolve Message',
    description: 'Disable the resolve message [OK] that is sent when alerting state returns to false',
    name: 'disableResolveMessage',
  },
  {
    label: 'Send reminders',
    description: 'Send additional notifications for triggered alerts',
    name: 'sendReminder',
  },
];
