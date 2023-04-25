import { cx } from '@emotion/css';
import React, { FC } from 'react';

import { useStyles2 } from '@grafana/ui';

import { FieldInputAttrs, LabeledFieldProps } from '../../../helpers/types';
import { LabelCore } from '../../Form/LabelCore';

import { getStyles } from './Checkbox.styles';

export interface BaseCheckboxProps extends FieldInputAttrs, LabeledFieldProps {
  inputId?: string;
  touched?: boolean;
  error?: string;
  fieldClassName?: string;
  noError?: boolean;
}

export const BaseCheckbox: FC<BaseCheckboxProps> = ({
  name,
  inputId = `input-${name}-id`,
  fieldClassName,
  label,
  touched,
  error,
  tooltipText = '',
  tooltipLink,
  tooltipLinkText,
  tooltipIcon,
  tooltipLinkTarget,
  tooltipDataTestId,
  noError,
  ...props
}) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.field, fieldClassName)} data-testid={`${name}-field-container`}>
      <label className={styles.wrapper} htmlFor={inputId}>
        <input
          id={inputId}
          name={name}
          type="checkbox"
          {...props}
          data-testid={`${name}-checkbox-input`}
          className={styles.input}
        />
        <span className={styles.checkmark} />
        <LabelCore
          name={name}
          label={label}
          labelWrapperClassName={styles.checkmarkLabel}
          labelClassName={styles.label}
          inputId={inputId}
          tooltipLink={tooltipLink}
          tooltipLinkText={tooltipLinkText}
          tooltipText={tooltipText}
          tooltipDataTestId={tooltipDataTestId}
          tooltipLinkTarget={tooltipLinkTarget}
          tooltipIcon={tooltipIcon}
        />
      </label>
      {!noError && (
        <div data-testid={`${name}-field-error-message`} className={styles.errorMessage}>
          {touched && error}
        </div>
      )}
    </div>
  );
};

BaseCheckbox.displayName = 'Checkbox';
