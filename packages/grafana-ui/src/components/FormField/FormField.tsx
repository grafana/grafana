import { css, cx } from '@emotion/css';
import React, { InputHTMLAttributes } from 'react';

import { InlineFormLabel } from '../FormLabel/FormLabel';
import { PopoverContent } from '../Tooltip';

export interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  tooltip?: PopoverContent;
  labelWidth?: number;
  // If null no width will be specified not even default one
  inputWidth?: number | null;
  inputEl?: React.ReactNode;
  /** Make tooltip interactive */
  interactive?: boolean;
}

const defaultProps = {
  labelWidth: 6,
  inputWidth: 12,
};

/**
 * Default form field including label used in Grafana UI. Default input element is simple <input />. You can also pass
 * custom inputEl if required in which case inputWidth and inputProps are ignored.
 */
export const FormField = ({
  label,
  tooltip,
  labelWidth,
  inputWidth,
  inputEl,
  className,
  interactive,
  ...inputProps
}: Props) => {
  const styles = getStyles();
  return (
    <div className={cx(styles.formField, className)}>
      <InlineFormLabel width={labelWidth} tooltip={tooltip} interactive={interactive}>
        {label}
      </InlineFormLabel>
      {inputEl || (
        <input
          type="text"
          className={`gf-form-input ${inputWidth ? `width-${inputWidth}` : ''}`}
          {...inputProps}
          disabled={inputProps.disabled}
        />
      )}
    </div>
  );
};

FormField.displayName = 'FormField';
FormField.defaultProps = defaultProps;

const getStyles = () => {
  return {
    formField: css`
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      text-align: left;
      position: relative;
    `,
  };
};
