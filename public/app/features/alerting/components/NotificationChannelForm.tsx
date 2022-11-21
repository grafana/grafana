import { css } from '@emotion/css';
import React, { FC, useEffect } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Button, FormAPI, HorizontalGroup, Spinner, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';

import { NotificationChannelType, NotificationChannelDTO, NotificationChannelSecureFields } from '../../../types';

import { BasicSettings } from './BasicSettings';
import { ChannelSettings } from './ChannelSettings';
import { NotificationSettings } from './NotificationSettings';

interface Props
  extends Pick<FormAPI<NotificationChannelDTO>, 'control' | 'errors' | 'register' | 'watch' | 'getValues'> {
  selectableChannels: Array<SelectableValue<string>>;
  selectedChannel?: NotificationChannelType;
  imageRendererAvailable: boolean;
  secureFields: NotificationChannelSecureFields;
  resetSecureField: (key: string) => void;
  onTestChannel: (data: NotificationChannelDTO) => void;
}

export interface NotificationSettingsProps
  extends Pick<FormAPI<NotificationChannelDTO>, 'control' | 'errors' | 'register'> {
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
  const styles = useStyles2(getStyles);

  useEffect(() => {
    /*
      Find fields that have dependencies on other fields and removes duplicates.
      Needs to be prefixed with settings.
    */
    const fieldsToWatch =
      new Set(
        selectedChannel?.options
          .filter((o) => o.showWhen.field)
          .map((option) => {
            return `settings.${option.showWhen.field}`;
          })
      ) || [];
    watch(['type', 'sendReminder', 'uploadImage', ...fieldsToWatch]);
  }, [selectedChannel?.options, watch]);

  const currentFormValues = getValues();

  if (!selectedChannel) {
    return <Spinner />;
  }

  return (
    <div className={styles.formContainer}>
      <div className={styles.formItem}>
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
      </div>
      {/* If there are no non-required fields, don't render this section*/}
      {selectedChannel.options.filter((o) => !o.required).length > 0 && (
        <div className={styles.formItem}>
          <ChannelSettings
            selectedChannel={selectedChannel}
            secureFields={secureFields}
            resetSecureField={resetSecureField}
            currentFormValues={currentFormValues}
            register={register}
            errors={errors}
            control={control}
          />
        </div>
      )}
      <div className={styles.formItem}>
        <NotificationSettings
          imageRendererAvailable={imageRendererAvailable}
          currentFormValues={currentFormValues}
          register={register}
          errors={errors}
          control={control}
        />
      </div>
      <div className={styles.formButtons}>
        <HorizontalGroup>
          <Button type="submit">Save</Button>
          <Button type="button" variant="secondary" onClick={() => onTestChannel(getValues())}>
            Test
          </Button>
          <a href={`${config.appSubUrl}/alerting/notifications`}>
            <Button type="button" variant="secondary">
              Back
            </Button>
          </a>
        </HorizontalGroup>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    formContainer: css``,
    formItem: css`
      flex-grow: 1;
      padding-top: ${theme.spacing(2)};
    `,
    formButtons: css`
      padding-top: ${theme.spacing(4)};
    `,
  };
};
