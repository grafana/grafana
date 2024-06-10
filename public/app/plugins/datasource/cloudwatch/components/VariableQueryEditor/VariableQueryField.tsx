import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { EditorField } from '@grafana/experimental';
import { Alert, InlineField, Select, useStyles2 } from '@grafana/ui';

import { VariableQueryType } from '../../types';
import { removeMarginBottom } from '../styles';

const LABEL_WIDTH = 20;

interface VariableQueryFieldProps<T> {
  onChange: (value: T) => void;
  options: SelectableValue[];
  value: T | null;
  label: string;
  inputId?: string;
  allowCustomValue?: boolean;
  isLoading?: boolean;
  newFormStylingEnabled?: boolean;
  error?: string;
}

export const VariableQueryField = <T extends string | VariableQueryType>({
  label,
  onChange,
  value,
  options,
  allowCustomValue = false,
  isLoading = false,
  inputId = label,
  newFormStylingEnabled,
  error,
}: VariableQueryFieldProps<T>) => {
  const styles = useStyles2(getStyles);
  return newFormStylingEnabled ? (
    <>
      <EditorField label={label} htmlFor={inputId} className={removeMarginBottom}>
        <Select
          aria-label={label}
          allowCustomValue={allowCustomValue}
          value={value}
          onChange={({ value }) => onChange(value!)}
          options={options}
          isLoading={isLoading}
          inputId={inputId}
        />
      </EditorField>
      {error && <Alert title={error} severity="error" topSpacing={1} />}
    </>
  ) : (
    <>
      <InlineField label={label} labelWidth={LABEL_WIDTH} htmlFor={inputId}>
        <Select
          aria-label={label}
          width={25}
          allowCustomValue={allowCustomValue}
          value={value}
          onChange={({ value }) => onChange(value!)}
          options={options}
          isLoading={isLoading}
          inputId={inputId}
        />
      </InlineField>
      {error && <Alert className={styles.inlineFieldAlert} title={error} severity="error" topSpacing={1} />}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  // width set to InlineField labelWidth + Select width + 0.5 for margin on the label
  inlineFieldAlert: css({ maxWidth: theme.spacing(LABEL_WIDTH + 25 + 0.5) }),
});
