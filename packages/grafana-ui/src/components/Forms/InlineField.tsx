import React, { InputHTMLAttributes, FC } from 'react';
import { cx, css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '../../themes';
import { InlineFormLabel } from './InlineFormLabel';
import { PopoverContent } from '../Tooltip/Tooltip';

export interface Props extends InputHTMLAttributes<HTMLInputElement> {
  /** Form input element, i.e Input or Switch */
  children: React.ReactElement;
  /** Label for the field */
  label?: string | React.ReactNode;
  tooltip?: PopoverContent;
  labelWidth?: number;
  /** Indicates if field is in invalid state */
  invalid?: boolean;
  /** Indicates if field is in loading state */
  loading?: boolean;
  /** Indicates if field is disabled */
  disabled?: boolean;
}

/**
 * Default form field including label used in Grafana UI. Default input element is simple <input />. You can also pass
 * custom inputEl if required in which case inputWidth and inputProps are ignored.
 */
export const InlineField: FC<Props> = ({
  label,
  tooltip,
  labelWidth = 6,
  children,
  className,
  invalid,
  disabled,
  loading,
}) => {
  const styles = useStyles(getStyles);
  let inputId;
  const child = React.Children.map(children, c => c)[0];

  if (child) {
    inputId = (child as React.ReactElement<{ id?: string }>).props.id;
  }
  const labelElement =
    typeof label === 'string' ? (
      <InlineFormLabel width={labelWidth} tooltip={tooltip} htmlFor={inputId}>
        label
      </InlineFormLabel>
    ) : (
      label
    );

  return (
    <div className={cx(styles.container, className)}>
      {labelElement}
      {React.cloneElement(children, { invalid, disabled, loading })}
    </div>
  );
};

InlineField.displayName = 'InlineField';

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      text-align: left;
      position: relative;
    `,
  };
};
