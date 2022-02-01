import React, { FC } from 'react';
import { cx, css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '../../themes';
import { InlineLabel } from './InlineLabel';
import { PopoverContent } from '../Tooltip/Tooltip';
import { FieldProps } from './Field';
import { getChildId } from '../../utils/reactUtils';
import { FieldValidationMessage } from './FieldValidationMessage';

export interface Props extends Omit<FieldProps, 'css' | 'horizontal' | 'description' | 'error'> {
  /** Content for the label's tooltip */
  tooltip?: PopoverContent;
  /** Custom width for the label as a multiple of 8px */
  labelWidth?: number | 'auto';
  /** Make the field's child to fill the width of the row. Equivalent to setting `flex-grow:1` on the field */
  grow?: boolean;
  /** Make field's background transparent */
  transparent?: boolean;
  /** Error message to display */
  error?: string | null;
  htmlFor?: string;
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
  htmlFor,
  grow,
  error,
  transparent,
  ...htmlProps
}) => {
  const theme = useTheme2();
  const styles = getStyles(theme, grow);
  const inputId = htmlFor ?? getChildId(children);

  const labelElement =
    typeof label === 'string' ? (
      <InlineLabel width={labelWidth} tooltip={tooltip} htmlFor={inputId} transparent={transparent}>
        {label}
      </InlineLabel>
    ) : (
      label
    );

  return (
    <div className={cx(styles.container, className)} {...htmlProps}>
      {labelElement}
      <div className={styles.childContainer}>
        {React.cloneElement(children, { invalid, disabled, loading })}
        {invalid && error && (
          <div className={cx(styles.fieldValidationWrapper)}>
            <FieldValidationMessage>{error}</FieldValidationMessage>
          </div>
        )}
      </div>
    </div>
  );
};

InlineField.displayName = 'InlineField';

const getStyles = (theme: GrafanaTheme2, grow?: boolean) => {
  return {
    container: css`
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      text-align: left;
      position: relative;
      flex: ${grow ? 1 : 0} 0 auto;
      margin: 0 ${theme.spacing(0.5)} ${theme.spacing(0.5)} 0;
    `,
    childContainer: css`
      flex: ${grow ? 1 : 0} 0 auto;
    `,
    fieldValidationWrapper: css`
      margin-top: ${theme.spacing(0.5)};
    `,
  };
};
