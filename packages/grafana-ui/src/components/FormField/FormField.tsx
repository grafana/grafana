import { css, cx } from '@emotion/css';
import { InputHTMLAttributes, useId } from 'react';
import * as React from 'react';

import { InlineFormLabel } from '../FormLabel/FormLabel';
import { Field } from '../Forms/Field';
import { InlineField } from '../Forms/InlineField';
import { PopoverContent } from '../Tooltip/types';

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

/**
 * Default form field including label used in Grafana UI. Default input element is simple <input />. You can also pass
 * custom inputEl if required in which case inputWidth and inputProps are ignored.
 *
 * For inline fields, use {@link InlineField}, {@link https://developers.grafana.com/ui/latest/index.html?path=/story/forms-inlinefield--basic See Storybook}.
 * @deprecated Please use the {@link Field} component, {@link https://developers.grafana.com/ui/latest/index.html?path=/story/forms-field--simple See Storybook}.
 */
export const FormField = ({
  label,
  tooltip,
  labelWidth = 6,
  inputWidth = 12,
  inputEl,
  className,
  interactive,
  ...inputProps
}: Props) => {
  const styles = getStyles();
  const id = useId();
  return (
    <div className={cx(styles.formField, className)}>
      <InlineFormLabel htmlFor={id} width={labelWidth} tooltip={tooltip} interactive={interactive}>
        {label}
      </InlineFormLabel>
      {inputEl || (
        <input
          id={id}
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

const getStyles = () => {
  return {
    formField: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      textAlign: 'left',
      position: 'relative',
    }),
  };
};
