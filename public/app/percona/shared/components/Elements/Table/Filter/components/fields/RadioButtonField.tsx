import React, { ReactNode } from 'react';

import { useStyles2 } from '@grafana/ui';
import { RadioButtonGroupField } from 'app/percona/shared/components/Form/RadioButtonGroup';

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
        label={column.label ?? (column.Header as ReactNode)}
        fullWidth
        data-testid="radio-button"
      />
    </div>
  );
};
