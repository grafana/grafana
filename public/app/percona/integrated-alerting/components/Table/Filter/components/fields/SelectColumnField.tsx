/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Field } from 'react-final-form';

import { SelectableValue } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { SelectField } from 'app/percona/shared/components/Form/SelectField';

import { ALL_LABEL, ALL_VALUE, SEARCH_SELECT_FIELD_NAME } from '../../Filter.constants';
import { getStyles } from '../../Filter.styles';

export const SelectColumnField = ({ searchColumnsOptions }: { searchColumnsOptions: Array<SelectableValue<any>> }) => {
  const styles = useStyles2(getStyles);
  return (
    <Field name={SEARCH_SELECT_FIELD_NAME}>
      {({ input }) => (
        <SelectField
          defaultValue={{ value: ALL_VALUE, label: ALL_LABEL }}
          className={styles.searchSelect}
          options={searchColumnsOptions ?? []}
          {...input}
          data-testid={SEARCH_SELECT_FIELD_NAME}
        />
      )}
    </Field>
  );
};
