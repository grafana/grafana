import { RadioButtonGroupField } from '@percona/platform-core';
import React from 'react';

import { useStyles2 } from '@grafana/ui';

import { ExtendedColumn } from '../../..';
import { ALL_VALUE } from '../../Filter.constants';
import { buildColumnOptions } from '../../Filter.utils';

import { getStyles } from './RadioButtonField.styles';

export const RadioButtonField = ({ column }: { column: ExtendedColumn }) => {
  const columnOptions = buildColumnOptions(column);
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.radioButtonField}>
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
