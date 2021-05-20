import { Checkbox, Field } from '@grafana/ui';
import React, { FC } from 'react';
import { CommonSettingsComponentProps } from '../../../types/receiver-form';
import { useFormContext } from 'react-hook-form';

export const GrafanaCommonChannelSettings: FC<CommonSettingsComponentProps> = ({ pathPrefix, className }) => {
  const { register } = useFormContext();
  return (
    <div className={className}>
      <Field>
        <Checkbox
          {...register(`${pathPrefix}disableResolveMessage`)}
          label="Disable resolved message"
          description="Disable the resolve message [OK] that is sent when alerting state returns to false"
        />
      </Field>
    </div>
  );
};
