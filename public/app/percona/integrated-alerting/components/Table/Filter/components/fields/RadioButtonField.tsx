import { RadioButtonGroupField } from '@percona/platform-core';
import React from 'react';

import { ExtendedColumn } from '../../..';
import { ALL_VALUE } from '../../Filter.constants';
import { buildColumnOptions } from '../../Filter.utils';

export const RadioButtonField = ({ column }: { column: ExtendedColumn }) => {
  const columnOptions = buildColumnOptions(column);
  return (
    <div>
      <RadioButtonGroupField
        options={columnOptions}
        defaultValue={ALL_VALUE}
        name={`${column.accessor}`}
        label={column.label ?? column.Header}
        fullWidth
        data-testid="radio-button"
      />
    </div>
  );
};
