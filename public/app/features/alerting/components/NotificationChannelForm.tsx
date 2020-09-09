import React, { FC, useEffect } from 'react';
import { css } from 'emotion';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { Button, FormAPI, HorizontalGroup, stylesFactory, useTheme, Spinner } from '@grafana/ui';
import { NotificationChannelType, NotificationChannelDTO, NotificationChannelSecureFields } from '../../../types';
import { NotificationSettings } from './NotificationSettings';
import { BasicSettings } from './BasicSettings';
import { ChannelSettings } from './ChannelSettings';

interface Props extends Omit<FormAPI<NotificationChannelDTO>, 'formState'> {
  selectableChannels: Array<SelectableValue<string>>;
  selectedChannel?: NotificationChannelType;
  imageRendererAvailable: boolean;
  secureFields: NotificationChannelSecureFields;
  resetSecureField: (key: string) => void;
  onTestChannel: (data: NotificationChannelDTO) => void;
}

export interface NotificationSettingsProps
  extends Omit<FormAPI<NotificationChannelDTO>, 'formState' | 'watch' | 'getValues'> {
  currentFormValues: NotificationChannelDTO;
}

export const NotificationChannelForm: FC<Props> = ({
  control,
  errors,
  selectedChannel,
  selectableChannels,
  register,
  watch,
  getValues,
  imageRendererAvailable,
  onTestChannel,
  resetSecureField,
  secureFields,
}) => {
  const styles = getStyles(useTheme());

  useEffect(() => {
    watch(['type', 'settings.priority', 'sendReminder', 'uploadImage']);
  }, []);

  const currentFormValues = getValues();
  return selectedChannel ? (
    <>
      <div className={styles.basicSettings}>
        <BasicSettings
          selectedChannel={selectedChannel}
          channels={selectableChannels}
          secureFields={secureFields}
          resetSecureField={resetSecureField}
          currentFormValues={currentFormValues}
          register={register}
          errors={errors}
          control={control}
        />
        {/* If there are no non-required fields, don't render this section*/}
        {selectedChannel.options.filter(o => !o.required).length > 0 && (
          <ChannelSettings
            selectedChannel={selectedChannel}
            secureFields={secureFields}
            resetSecureField={resetSecureField}
            currentFormValues={currentFormValues}
            register={register}
            errors={errors}
            control={control}
          />
        )}
        <NotificationSettings
          imageRendererAvailable={imageRendererAvailable}
          currentFormValues={currentFormValues}
          register={register}
          errors={errors}
          control={control}
        />
      </div>
      <HorizontalGroup>
        <Button type="submit">Save</Button>
        <Button type="button" variant="secondary" onClick={() => onTestChannel(getValues({ nest: true }))}>
          Test
        </Button>
        <a href="/alerting/notifications">
          <Button type="button" variant="secondary">
            Back
          </Button>
        </a>
      </HorizontalGroup>
    </>
  ) : (
    <Spinner />
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    basicSettings: css`
      margin-bottom: ${theme.spacing.xl};
    `,
  };
});
