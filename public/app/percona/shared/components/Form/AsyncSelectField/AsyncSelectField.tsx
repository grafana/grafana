import React, { FC } from 'react';
import { AsyncSelect } from '@grafana/ui';
import { withSelectStyles } from '../withSelectStyles/withSelectStyles';
import { Label } from '../Label';
import { AsyncSelectFieldProps } from './AsyncSelectField.types';

const AsyncSelectFieldWrapper: FC<AsyncSelectFieldProps<any>> = ({ label, name, ...props }) => (
  <>
    <Label label={label} dataQa={`${name}-select-label`} />
    <AsyncSelect {...props} />
  </>
);

export const AsyncSelectField = withSelectStyles(AsyncSelectFieldWrapper);
