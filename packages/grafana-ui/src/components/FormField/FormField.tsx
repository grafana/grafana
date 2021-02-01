import React, { InputHTMLAttributes, FunctionComponent } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { InlineFormLabel } from '../FormLabel/FormLabel';
import { PopoverContent } from '../Tooltip/Tooltip';
import { useStyles } from '../../themes';

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
  const styles = useStyles(getStyles);
  return (
    <div className={cx(styles.formField, className)}>
      <InlineFormLabel width={labelWidth} tooltip={tooltip}>
        {label}
      </InlineFormLabel>
      {inputEl || (
        <input type="text" className={`gf-form-input ${inputWidth ? `width-${inputWidth}` : ''}`} {...inputProps} />
      )}
    </div>
  );
};

FormField.displayName = 'FormField';
FormField.defaultProps = defaultProps;

const getStyles = (theme: GrafanaTheme) => {
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
