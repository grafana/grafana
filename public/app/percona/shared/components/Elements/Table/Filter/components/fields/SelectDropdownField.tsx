import React from 'react';
import { Field } from 'react-final-form';

import { SelectField } from 'app/percona/shared/components/Form/SelectField';

import { ExtendedColumn } from '../../..';
import { ALL_LABEL, ALL_VALUE } from '../../Filter.constants';
import { buildColumnOptions } from '../../Filter.utils';

export const SelectDropdownField = <T extends object>({ column }: { column: ExtendedColumn<T> }) => {
  const columnOptions = buildColumnOptions(column);
  return (
    <div>
      <Field name={String(column.accessor)}>
        {({ input }) => (
          <SelectField
            options={columnOptions}
            defaultValue={{ value: ALL_VALUE, label: ALL_LABEL }}
            label={column.label ?? column.Header}
            {...input}
            data-testid="select-dropdown"
          />
        )}
      </Field>
    </div>
  );
};
