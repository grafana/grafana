import React, { FC } from 'react';
import { useFormContext } from 'react-hook-form';

import { Checkbox, Field } from '@grafana/ui';

import { CommonSettingsComponentProps } from '../../../types/receiver-form';

export const GrafanaCommonChannelSettings: FC<CommonSettingsComponentProps> = ({
  pathPrefix,
  className,
  readOnly = false,
}) => {
  const { register } = useFormContext();
  return (
    <div className={className}>
      <Field>
        <Checkbox
          {...register(`${pathPrefix}disableResolveMessage`)}
          label="Disable resolved message"
          description="Disable the resolve message [OK] that is sent when alerting state returns to false"
          disabled={readOnly}
        />
      </Field>
    </div>
  );
};
