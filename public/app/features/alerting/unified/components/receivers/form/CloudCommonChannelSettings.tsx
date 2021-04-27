import { Checkbox, Field } from '@grafana/ui';
import React, { FC } from 'react';
import { CommonSettingsComponentProps } from '../../../types/receiver-form';
import { useFormContext } from 'react-hook-form';

export const CloudCommonChannelSettings: FC<CommonSettingsComponentProps> = ({ pathPrefix, className }) => {
  const { register } = useFormContext();
  return (
    <div className={className}>
      <Field>
        <Checkbox
          name={`${pathPrefix}sendResolved`}
          ref={register()}
          label="Send resolved"
          description="Whether or not to notify about resolved alerts."
        />
      </Field>
    </div>
  );
};
