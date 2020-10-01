import React, { FC } from 'react';
import { cx, css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme } from '../../themes';
import { InlineLabel } from './InlineLabel';
import { PopoverContent } from '../Tooltip/Tooltip';
import { FieldProps } from './Field';

export interface Props extends Omit<FieldProps, 'css' | 'horizontal' | 'description' | 'error'> {
  /** Content for the label's tooltip */
  tooltip?: PopoverContent;
  /** Custom width for the label */
  labelWidth?: number | 'auto';
  /** Make the field's child to fill the width of the row. Equivalent to setting `flex-grow:1` on the field */
  grow?: boolean;
}

export const InlineField: FC<Props> = ({
  children,
  label,
  tooltip,
  labelWidth = 'auto',
  invalid,
  loading,
  disabled,
  className,
  grow,
  ...htmlProps
}) => {
  const theme = useTheme();
  const styles = getStyles(theme, grow);
  const child = React.Children.only(children);
  let inputId;

  if (child) {
    inputId = (child as React.ReactElement<{ id?: string }>).props.id;
  }
  const labelElement =
    typeof label === 'string' ? (
      <InlineLabel width={labelWidth} tooltip={tooltip} htmlFor={inputId}>
        {label}
      </InlineLabel>
    ) : (
      label
    );

  return (
    <div className={cx(styles.container, className)} {...htmlProps}>
      {labelElement}
      {React.cloneElement(children, { invalid, disabled, loading })}
    </div>
  );
};

InlineField.displayName = 'InlineField';

const getStyles = (theme: GrafanaTheme, grow?: boolean) => {
  return {
    container: css`
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      text-align: left;
      position: relative;
      flex: ${grow ? 1 : 0} 0 auto;
      margin: 0 ${theme.spacing.xs} ${theme.spacing.xs} 0;
    `,
    wrapper: css`
      display: flex;
      width: 100%;
    `,

    fillContainer: css`
      flex-grow: 1;
    `,
  };
};
