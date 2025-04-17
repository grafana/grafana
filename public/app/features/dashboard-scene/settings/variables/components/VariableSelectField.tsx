import { css } from '@emotion/css';
import { PropsWithChildren, useId } from 'react';
import * as React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Field, Select, useStyles2 } from '@grafana/ui';

interface VariableSelectFieldProps<T> {
  name: string;
  value?: SelectableValue<T>;
  options: Array<SelectableValue<T>>;
  onChange: (option: SelectableValue<T>) => void;
  testId?: string;
  width?: number;
  description?: React.ReactNode;
}

export function VariableSelectField({
  name,
  description,
  value,
  options,
  onChange,
  testId,
  width,
}: PropsWithChildren<VariableSelectFieldProps<any>>) {
  const styles = useStyles2(getStyles);
  const uniqueId = useId();
  const inputId = `variable-select-input-${name}-${uniqueId}`;

  return (
    <Field label={name} description={description} htmlFor={inputId}>
      <Select
        data-testid={testId}
        inputId={inputId}
        onChange={onChange}
        value={value}
        width={width ?? 30}
        options={options}
        className={styles.selectContainer}
      />
    </Field>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    selectContainer: css({
      marginRight: theme.spacing(0.5),
    }),
  };
}
