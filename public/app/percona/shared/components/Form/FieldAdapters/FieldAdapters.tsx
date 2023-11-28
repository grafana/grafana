// @ts-nocheck
import { cx } from '@emotion/css';
import React from 'react';

import { Select, Spinner, useTheme } from '@grafana/ui';

import { Field } from './Field';
import { Messages } from './FieldAdapters.messages';
import { getStyles } from './FieldAdapters.styles';

export const SelectFieldAdapter = ({
  input,
  className,
  options,
  label,
  meta,
  dataTestId,
  showErrorOnBlur = true,
  noOptionsMessage,
  ...props
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const validationError = (!showErrorOnBlur || meta.touched) && meta.error;

  return (
    <Field label={label}>
      <div data-testid={dataTestId}>
        <Select
          {...input}
          {...props}
          options={options}
          className={cx(styles.input, className)}
          invalid={!!validationError}
          noOptionsMessage={noOptionsMessage}
        />
        <div data-testid="select-field-error-message" className={styles.errorMessage}>
          {validationError}
        </div>
      </div>
    </Field>
  );
};

export const AsyncSelectFieldAdapter: FC<React.PropsWithChildren<any>> = ({
  input,
  className,
  loading,
  options,
  label,
  meta,
  dataTestId,
  noOptionsMessage,
  ...props
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <Field label={label}>
      <div data-testid={dataTestId}>
        <div className={styles.asyncSelectWrapper}>
          <Select
            {...input}
            {...props}
            options={loading ? [] : options}
            className={cx(styles.input, className)}
            invalid={meta.touched && meta.error}
            noOptionsMessage={loading ? Messages.loadingOptions : noOptionsMessage}
          />
          {loading && <Spinner className={styles.selectSpinner} />}
        </div>
        <div data-testid="async-select-field-error-message" className={styles.errorMessage}>
          {meta.touched && meta.error}
        </div>
      </div>
    </Field>
  );
};
