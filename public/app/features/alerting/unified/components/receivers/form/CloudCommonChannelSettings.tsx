import React from 'react';
import { useFormContext } from 'react-hook-form';

import { Checkbox, Field } from '@grafana/ui';

import { CommonSettingsComponentProps } from '../../../types/receiver-form';

export const CloudCommonChannelSettings = ({
  pathPrefix,
  className,
  readOnly = false,
}: CommonSettingsComponentProps) => {
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
