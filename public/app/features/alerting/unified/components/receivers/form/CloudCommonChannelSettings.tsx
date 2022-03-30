import { Checkbox, Field } from '@grafana/ui';
import React, { FC } from 'react';
import { CommonSettingsComponentProps } from '../../../types/receiver-form';
import { useFormContext } from 'react-hook-form';

export const CloudCommonChannelSettings: FC<CommonSettingsComponentProps> = ({
  pathPrefix,
  className,
  readOnly = false,
}) => {
  const { register } = useFormContext();
  return (
    <div className={className}>
      <Field disabled={readOnly}>
        <Checkbox
          {...register(`${pathPrefix}sendResolved`)}
          label="Send resolved"
          disabled={readOnly}
          description="Whether or not to notify about resolved alerts."
        />
      </Field>
    </div>
  );
};
