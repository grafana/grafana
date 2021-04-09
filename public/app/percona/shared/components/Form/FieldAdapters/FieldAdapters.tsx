// @ts-nocheck
import React from 'react';
import { cx } from 'emotion';
import { Select, Spinner, useTheme } from '@grafana/ui';
import { getStyles } from './FieldAdapters.styles';
import { Field } from './Field';
import { Messages } from './FieldAdapters.messages';

export const SelectFieldAdapter = ({
  input,
  className,
  options,
  label,
  meta,
  dataQa,
  showErrorOnBlur = true,
  noOptionsMessage,
  ...props
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const validationError = (!showErrorOnBlur || meta.touched) && meta.error;

  return (
    <Field label={label}>
      <div data-qa={dataQa}>
        <Select
          {...input}
          {...props}
          options={options}
          className={cx(styles.input, className)}
          invalid={!!validationError}
          noOptionsMessage={noOptionsMessage}
        />
        <div data-qa="select-field-error-message" className={styles.errorMessage}>
          {validationError}
        </div>
      </div>
    </Field>
  );
};

export const AsyncSelectFieldAdapter: FC<any> = ({
  input,
  className,
  loading,
  options,
  label,
  meta,
  dataQa,
  noOptionsMessage,
  ...props
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <Field label={label}>
      <div data-qa={dataQa}>
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
        <div data-qa="async-select-field-error-message" className={styles.errorMessage}>
          {meta.touched && meta.error}
        </div>
      </div>
    </Field>
  );
};
