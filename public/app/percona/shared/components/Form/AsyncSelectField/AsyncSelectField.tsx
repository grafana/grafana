import React, { FC } from 'react';

import { AsyncSelect } from '@grafana/ui';

import { Label } from '../Label';
import { withSelectStyles } from '../withSelectStyles/withSelectStyles';

import { AsyncSelectFieldProps } from './AsyncSelectField.types';

const AsyncSelectFieldWrapper: FC<AsyncSelectFieldProps<any>> = ({ label, name, ...props }) => (
  <>
    <Label label={label} dataTestId={`${name}-select-label`} />
    <AsyncSelect {...props} />
  </>
);

export const AsyncSelectField = withSelectStyles(AsyncSelectFieldWrapper);
