/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { FC } from 'react';

import { AsyncSelect } from '@grafana/ui';

import { Label } from '../Label';
import { withSelectStyles } from '../withSelectStyles/withSelectStyles';

import { AsyncSelectFieldProps } from './AsyncSelectField.types';

const AsyncSelectFieldWrapper: FC<AsyncSelectFieldProps<any>> = ({ label, name, className, ...props }) => (
  <>
    <Label label={label} dataTestId={`${name}-select-label`} />
    <AsyncSelect className={className} {...props} />
  </>
);

export const AsyncSelectField = withSelectStyles(AsyncSelectFieldWrapper);
