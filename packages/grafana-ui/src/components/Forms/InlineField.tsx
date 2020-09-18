import React, { InputHTMLAttributes, FC } from 'react';
import { cx, css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme } from '../../themes';
import { getInlineLabelStyles, InlineFormLabel } from './InlineFormLabel';
import { PopoverContent } from '../Tooltip/Tooltip';

export interface Props extends Omit<InputHTMLAttributes<HTMLDivElement>, 'className' | 'css'> {
  /** Form input element, i.e Input or Switch */
  children: React.ReactElement;
  /** Label for the field. If it's html elements and not a string */
  label?: React.ReactNode;
  /** Content for the label's tooltip */
  tooltip?: PopoverContent;
  /** Custom width for the label */
  labelWidth?: number | 'auto';
  /** Indicates if field is in invalid state */
  invalid?: boolean;
  /** Indicates if field is in loading state */
  loading?: boolean;
  /** Indicates if field is disabled */
  disabled?: boolean;
  /** Custom styles for the field */
  className?: string;
  /** Make the field's child to fill the width of the row. Equivalent to setting `flex-grow:1` on the field */
  grow?: boolean;
  /** A toggle to apply query keyword styling to the label */
  isKeyword?: boolean;
  /** Fill the remaining width of the row with the label's background */
  fill?: boolean;
}

export const InlineField: FC<Props> = ({
  children,
  label,
  tooltip,
  labelWidth = 6,
  invalid,
  loading,
  disabled,
  className,
  grow,
  fill,
  isKeyword,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme, grow, fill);
  const fillStyles = getInlineLabelStyles(theme, { grow: true }).label;
  const child = React.Children.only(children);
  let inputId;

  if (child) {
    inputId = (child as React.ReactElement<{ id?: string }>).props.id;
  }
  const labelElement =
    typeof label === 'string' ? (
      <InlineFormLabel width={labelWidth} tooltip={tooltip} htmlFor={inputId} isKeyword={isKeyword}>
        {label}
      </InlineFormLabel>
    ) : (
      label
    );

  return (
    <>
      <div className={cx(styles.container, className)}>
        {labelElement}
        {React.cloneElement(children, { invalid, disabled, loading })}
      </div>
      {fill && <div className={fillStyles} />}
    </>
  );
};

InlineField.displayName = 'InlineField';

const getStyles = (theme: GrafanaTheme, grow?: boolean, fill?: boolean) => {
  return {
    container: css`
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      text-align: left;
      position: relative;
      flex: ${grow ? 1 : 0} 0 auto;
      margin: 0 ${fill ? theme.spacing.xs : 0} ${theme.spacing.xs} 0;

      * {
        :focus {
          // Keep the focus outline inset
          box-shadow: none;
          border-color: ${theme.palette.blue95};
        }
      }
    `,
  };
};
