import React, { FC } from 'react';
import { useFormContext } from 'react-hook-form';

import { Checkbox, Field } from '@grafana/ui';

import { CommonSettingsComponentProps } from '../../../types/receiver-form';

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
