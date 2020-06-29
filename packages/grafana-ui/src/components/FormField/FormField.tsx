import React, { InputHTMLAttributes, FunctionComponent } from 'react';
import { FormLabel } from '../FormLabel/FormLabel';
import { PopoverContent } from '../Tooltip/Tooltip';
import { cx } from 'emotion';

export interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  tooltip?: PopoverContent;
  labelWidth?: number;
  // If null no width will be specified not even default one
  inputWidth?: number | null;
  inputEl?: React.ReactNode;
}

const defaultProps = {
  labelWidth: 6,
  inputWidth: 12,
};

/**
 * Default form field including label used in Grafana UI. Default input element is simple <input />. You can also pass
 * custom inputEl if required in which case inputWidth and inputProps are ignored.
 */
export const FormField: FunctionComponent<Props> = ({
  label,
  tooltip,
  labelWidth,
  inputWidth,
  inputEl,
  className,
  ...inputProps
}) => {
  return (
    <div className={cx('form-field', className)}>
      <FormLabel width={labelWidth} tooltip={tooltip}>
        {label}
      </FormLabel>
      {inputEl || (
        <input type="text" className={`gf-form-input ${inputWidth ? `width-${inputWidth}` : ''}`} {...inputProps} />
      )}
    </div>
  );
};

FormField.displayName = 'FormField';
FormField.defaultProps = defaultProps;
