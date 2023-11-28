import React, { FC } from 'react';
import { Controller } from 'react-hook-form';

import { LabelsFieldProps } from './LabelsField.types';
import LabelsBuilder from './components/LabelsBuilder';

const LabelsField: FC<React.PropsWithChildren<LabelsFieldProps>> = ({ control }) => (
  <Controller
    name="filter"
    control={control}
    render={({ field }) => <LabelsBuilder value={field.value || ''} onChange={field.onChange} />}
  />
);

export default LabelsField;
