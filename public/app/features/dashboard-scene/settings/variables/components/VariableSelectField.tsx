import { css } from '@emotion/css';
import React, { PropsWithChildren, ReactElement, useId } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Field, Select, useStyles2 } from '@grafana/ui';

interface VariableSelectFieldProps<T> {
  name: string;
  value: SelectableValue<T>;
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
}: PropsWithChildren<VariableSelectFieldProps<any>>): ReactElement {
  const styles = useStyles2(getStyles);
  const uniqueId = useId();
  const inputId = `variable-select-input-${name}-${uniqueId}`;

  return (
    <Field label={name} description={description} htmlFor={inputId}>
      <div data-testid={testId}>
        <Select
          inputId={inputId}
          onChange={onChange}
          value={value}
          width={width ?? 30}
          options={options}
          className={styles.selectContainer}
        />
      </div>
    </Field>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    selectContainer: css`
      margin-right: ${theme.spacing(0.5)};
    `,
  };
}
